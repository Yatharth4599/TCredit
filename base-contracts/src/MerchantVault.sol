// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IMerchantVault} from "./interfaces/IMerchantVault.sol";
import {WaterfallLib} from "./libraries/WaterfallLib.sol";
import {Errors} from "./libraries/Errors.sol";

/// @title MerchantVault — Credit line + waterfall repayment for an AI agent
/// @notice Deployed per borrowing agent via VaultFactory
contract MerchantVault is IMerchantVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public immutable agent;
    address public immutable factory;
    address public paymentRouter;
    address public admin;

    VaultState public state;

    // Fundraising
    uint256 public targetAmount;
    uint256 public totalRaised;
    uint256 public interestRateBps;
    uint256 public durationSeconds;
    uint256 public numTranches;
    uint256 public tranchesReleased;

    // Repayment
    uint256 public totalRepaid;
    uint256 public totalToRepay;
    uint256 public activatedAt;

    // Waterfall accounting
    uint256 public seniorFunded;   // total senior capital
    uint256 public poolFunded;     // total pool capital
    uint256 public userFunded;     // total community capital
    uint256 public totalSeniorRepaid;
    uint256 public totalPoolRepaid;
    uint256 public totalCommunityRepaid;

    // Platform fees
    uint16 public platformFeeBps;
    address public platformFeeRecipient;
    uint256 public platformFeesCollected;

    // Late fees
    uint16 public lateFeeBps;
    uint256 public totalLateFees;
    uint256 public gracePeriodSeconds;

    // Investor tracking
    mapping(address => uint256) public investorBalances;
    mapping(address => uint256) public claimedReturns;
    mapping(address => bool) public isSeniorInvestor;
    address[] public investors;

    address public pendingAdmin;
    bool public paused;

    // ─── Modifiers ───────────────────────────────────────────────

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Errors.Unauthorized();
        _;
    }

    modifier onlyPaymentRouter() {
        if (msg.sender != paymentRouter) revert Errors.Unauthorized();
        _;
    }

    modifier notPaused() {
        if (paused) revert Errors.VaultPaused();
        _;
    }

    modifier inState(VaultState expected) {
        if (state != expected) revert Errors.InvalidVaultState();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────

    constructor(
        address _usdc,
        address _agent,
        address _admin,
        address _factory,
        uint256 _targetAmount,
        uint256 _interestRateBps,
        uint256 _durationSeconds,
        uint256 _numTranches,
        uint16 _platformFeeBps,
        address _platformFeeRecipient
    ) {
        if (_usdc == address(0) || _agent == address(0) || _admin == address(0))
            revert Errors.ZeroAddress();
        if (_targetAmount == 0) revert Errors.InvalidAmount();
        if (_numTranches == 0) revert Errors.InvalidTrancheCount();

        usdc = IERC20(_usdc);
        agent = _agent;
        admin = _admin;
        factory = _factory;
        targetAmount = _targetAmount;
        interestRateBps = _interestRateBps;
        durationSeconds = _durationSeconds;
        numTranches = _numTranches;
        platformFeeBps = _platformFeeBps;
        platformFeeRecipient = _platformFeeRecipient;
        state = VaultState.Fundraising;
    }

    // ─── Admin Setup ─────────────────────────────────────────────

    function setPaymentRouter(address _router) external onlyAdmin {
        if (_router == address(0)) revert Errors.ZeroAddress();
        address old = paymentRouter;
        paymentRouter = _router;
        emit PaymentRouterUpdated(old, _router);
    }

    function proposeAdmin(address _newAdmin) external onlyAdmin {
        if (_newAdmin == address(0)) revert Errors.ZeroAddress();
        pendingAdmin = _newAdmin;
        emit AdminTransferProposed(admin, _newAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert Errors.Unauthorized();
        address old = admin;
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferred(old, admin);
    }

    // ─── Invest ──────────────────────────────────────────────────

    function invest(uint256 amount) external nonReentrant notPaused inState(VaultState.Fundraising) {
        if (amount == 0) revert Errors.InvalidAmount();
        if (totalRaised + amount > targetAmount) revert Errors.ExceedsTarget();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        if (investorBalances[msg.sender] == 0) {
            investors.push(msg.sender);
        }
        investorBalances[msg.sender] += amount;
        totalRaised += amount;

        emit Invested(msg.sender, amount, totalRaised);

        // Auto-activate when fully funded
        if (totalRaised == targetAmount) {
            _activate();
        }
    }

    /// @notice Invest as senior tranche (called by pool or admin)
    function investSenior(uint256 amount) external nonReentrant notPaused inState(VaultState.Fundraising) {
        if (amount == 0) revert Errors.InvalidAmount();
        if (totalRaised + amount > targetAmount) revert Errors.ExceedsTarget();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        if (investorBalances[msg.sender] == 0) {
            investors.push(msg.sender);
        }
        investorBalances[msg.sender] += amount;
        isSeniorInvestor[msg.sender] = true;
        seniorFunded += amount;
        totalRaised += amount;

        emit Invested(msg.sender, amount, totalRaised);

        if (totalRaised == targetAmount) {
            _activate();
        }
    }

    /// @notice Invest from a liquidity pool
    function investFromPool(uint256 amount) external nonReentrant notPaused inState(VaultState.Fundraising) {
        if (amount == 0) revert Errors.InvalidAmount();
        if (totalRaised + amount > targetAmount) revert Errors.ExceedsTarget();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        poolFunded += amount;
        totalRaised += amount;

        emit Invested(msg.sender, amount, totalRaised);

        if (totalRaised == targetAmount) {
            _activate();
        }
    }

    // ─── Tranche Release ─────────────────────────────────────────

    function releaseTranche() external onlyAdmin notPaused {
        if (state != VaultState.Active && state != VaultState.Repaying)
            revert Errors.InvalidVaultState();
        if (tranchesReleased >= numTranches) revert Errors.AllTranchesReleased();

        tranchesReleased++;
        uint256 trancheSize = totalRaised / numTranches;
        uint256 trancheAmount;

        // Last tranche gets remainder to avoid dust (from integer division)
        if (tranchesReleased == numTranches) {
            trancheAmount = totalRaised - (numTranches - 1) * trancheSize;
        } else {
            trancheAmount = trancheSize;
        }

        usdc.safeTransfer(agent, trancheAmount);

        emit TrancheReleased(tranchesReleased, trancheAmount, agent);
    }

    // ─── Repayment (called by PaymentRouter) ─────────────────────

    function processRepayment(uint256 amount) external nonReentrant onlyPaymentRouter notPaused {
        if (state != VaultState.Active && state != VaultState.Repaying)
            revert Errors.InvalidVaultState();
        if (amount == 0) revert Errors.InvalidAmount();

        // Move to repaying state on first repayment
        if (state == VaultState.Active) {
            VaultState oldState = state;
            state = VaultState.Repaying;
            emit VaultStateChanged(oldState, VaultState.Repaying);
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Platform fee
        uint256 fee = 0;
        if (platformFeeBps > 0 && platformFeeRecipient != address(0)) {
            fee = (amount * platformFeeBps) / 10_000;
            platformFeesCollected += fee;
            usdc.safeTransfer(platformFeeRecipient, fee);
        }

        uint256 netRepayment = amount - fee;
        totalRepaid += netRepayment;

        // Waterfall distribution
        uint256 seniorOwed = seniorFunded > totalSeniorRepaid ? seniorFunded - totalSeniorRepaid : 0;
        uint256 poolOwed = poolFunded > totalPoolRepaid ? poolFunded - totalPoolRepaid : 0;

        WaterfallLib.Distribution memory dist = WaterfallLib.distribute(seniorOwed, poolOwed, netRepayment);

        totalSeniorRepaid += dist.seniorPayment;
        totalPoolRepaid += dist.poolPayment;
        totalCommunityRepaid += dist.communityPayment;

        emit RepaymentProcessed(amount, dist.seniorPayment, dist.poolPayment, dist.communityPayment);
        emit WaterfallDistributed(dist.seniorPayment, dist.poolPayment, dist.communityPayment);

        // Check completion
        if (totalRepaid >= totalToRepay) {
            VaultState oldState = state;
            state = VaultState.Completed;
            emit VaultStateChanged(oldState, VaultState.Completed);
        }
    }

    // ─── Claim Returns ───────────────────────────────────────────

    function claimReturns() external nonReentrant {
        if (state != VaultState.Repaying && state != VaultState.Completed)
            revert Errors.InvalidVaultState();

        uint256 claimable = _claimableFor(msg.sender);
        if (claimable == 0) revert Errors.NothingToClaim();

        claimedReturns[msg.sender] += claimable;
        usdc.safeTransfer(msg.sender, claimable);

        emit ReturnsClaimed(msg.sender, claimable);
    }

    // ─── Lifecycle ───────────────────────────────────────────────

    function markDefault() external onlyAdmin {
        if (state != VaultState.Active && state != VaultState.Repaying)
            revert Errors.InvalidVaultState();

        VaultState oldState = state;
        state = VaultState.Defaulted;
        emit VaultStateChanged(oldState, VaultState.Defaulted);
        emit VaultDefaulted(block.timestamp);
    }

    function cancel() external onlyAdmin inState(VaultState.Fundraising) {
        VaultState oldState = state;
        state = VaultState.Cancelled;
        emit VaultStateChanged(oldState, VaultState.Cancelled);
        emit VaultCancelled(block.timestamp);
    }

    function claimRefund() external nonReentrant {
        if (state != VaultState.Cancelled && state != VaultState.Defaulted)
            revert Errors.InvalidVaultState();

        uint256 balance = investorBalances[msg.sender];
        if (balance == 0) revert Errors.NothingToClaim();

        // For cancelled: full refund. For defaulted: pro-rata of remaining
        uint256 refund;
        if (state == VaultState.Cancelled) {
            refund = balance;
        } else {
            if (totalRaised == 0) revert Errors.NothingToClaim();
            uint256 remaining = usdc.balanceOf(address(this));
            refund = (balance * remaining) / totalRaised;
        }

        investorBalances[msg.sender] = 0;
        if (refund > 0) {
            usdc.safeTransfer(msg.sender, refund);
        }
    }

    function pause() external onlyAdmin {
        paused = true;
        emit VaultPaused();
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit VaultUnpaused();
    }

    // ─── View Functions ──────────────────────────────────────────

    function getAgent() external view returns (address) {
        return agent;
    }

    function getState() external view returns (VaultState) {
        return state;
    }

    function getTotalRaised() external view returns (uint256) {
        return totalRaised;
    }

    function getTotalRepaid() external view returns (uint256) {
        return totalRepaid;
    }

    function getTotalToRepay() external view returns (uint256) {
        return totalToRepay;
    }

    function getInvestorBalance(address investor) external view returns (uint256) {
        return investorBalances[investor];
    }

    function getClaimable(address investor) external view returns (uint256) {
        return _claimableFor(investor);
    }

    function getInvestors() external view returns (address[] memory) {
        return investors;
    }

    function getWaterfallState()
        external
        view
        returns (
            uint256 _seniorFunded,
            uint256 _poolFunded,
            uint256 _userFunded,
            uint256 _seniorRepaid,
            uint256 _poolRepaid,
            uint256 _communityRepaid
        )
    {
        return (seniorFunded, poolFunded, userFunded, totalSeniorRepaid, totalPoolRepaid, totalCommunityRepaid);
    }

    // ─── Internal ────────────────────────────────────────────────

    function _activate() internal {
        if (seniorFunded + poolFunded > totalRaised) revert Errors.ArithmeticOverflow();
        userFunded = totalRaised - seniorFunded - poolFunded;

        // totalToRepay = principal + interest
        // Simple interest: principal * rate * duration / (365 days * 10_000)
        uint256 interest = (totalRaised * interestRateBps * durationSeconds) / (365 days * 10_000);
        totalToRepay = totalRaised + interest;

        VaultState oldState = state;
        state = VaultState.Active;
        activatedAt = block.timestamp;
        emit VaultStateChanged(oldState, VaultState.Active);
    }

    function _claimableFor(address investor) internal view returns (uint256) {
        uint256 balance = investorBalances[investor];
        if (balance == 0) return 0;

        // Community investors claim pro-rata from community repaid amount
        if (!isSeniorInvestor[investor] && userFunded > 0) {
            uint256 share = (balance * totalCommunityRepaid) / userFunded;
            return share > claimedReturns[investor] ? share - claimedReturns[investor] : 0;
        }

        // Senior investors claim pro-rata from senior repaid amount
        if (isSeniorInvestor[investor] && seniorFunded > 0) {
            uint256 share = (balance * totalSeniorRepaid) / seniorFunded;
            return share > claimedReturns[investor] ? share - claimedReturns[investor] : 0;
        }

        return 0;
    }

    function _totalClaimable() internal view returns (uint256) {
        return totalSeniorRepaid + totalPoolRepaid + totalCommunityRepaid;
    }
}
