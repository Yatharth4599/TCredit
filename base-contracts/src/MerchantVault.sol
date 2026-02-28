// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IMerchantVault} from "./interfaces/IMerchantVault.sol";
import {IMilestoneRegistry} from "./interfaces/IMilestoneRegistry.sol";
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

    // x402-aware repayment tracking
    uint256 public nextPaymentDue;
    uint256 public expectedRepaymentPerPeriod;
    uint256 public constant REPAYMENT_INTERVAL = 30 days;

    // Fundraising deadline (for keeper auto-cancel)
    uint256 public fundraisingDeadline;

    // Milestone registry (for tranche gating)
    IMilestoneRegistry public milestoneRegistry;

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

    struct VaultParams {
        address usdc;
        address agent;
        address admin;
        address factory;
        uint256 targetAmount;
        uint256 interestRateBps;
        uint256 durationSeconds;
        uint256 numTranches;
        uint16 platformFeeBps;
        address platformFeeRecipient;
        uint16 lateFeeBps;
        uint256 gracePeriodSeconds;
        uint256 fundraisingDeadline;
    }

    constructor(VaultParams memory p) {
        if (p.usdc == address(0) || p.agent == address(0) || p.admin == address(0))
            revert Errors.ZeroAddress();
        if (p.targetAmount == 0) revert Errors.InvalidAmount();
        if (p.numTranches == 0) revert Errors.InvalidTrancheCount();

        usdc = IERC20(p.usdc);
        agent = p.agent;
        admin = p.admin;
        factory = p.factory;
        targetAmount = p.targetAmount;
        interestRateBps = p.interestRateBps;
        durationSeconds = p.durationSeconds;
        numTranches = p.numTranches;
        platformFeeBps = p.platformFeeBps;
        platformFeeRecipient = p.platformFeeRecipient;
        lateFeeBps = p.lateFeeBps;
        gracePeriodSeconds = p.gracePeriodSeconds;
        fundraisingDeadline = p.fundraisingDeadline;
        state = VaultState.Fundraising;
    }

    // ─── Admin Setup ─────────────────────────────────────────────

    function setPaymentRouter(address _router) external onlyAdmin {
        if (_router == address(0)) revert Errors.ZeroAddress();
        address old = paymentRouter;
        paymentRouter = _router;
        emit PaymentRouterUpdated(old, _router);
    }

    function setMilestoneRegistry(address _milestoneRegistry) external onlyAdmin {
        milestoneRegistry = IMilestoneRegistry(_milestoneRegistry);
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

        // Milestone gate: if registry is set, require milestone approved for this tranche
        if (address(milestoneRegistry) != address(0)) {
            if (!milestoneRegistry.isMilestoneApproved(address(this), tranchesReleased + 1))
                revert Errors.MilestoneNotApproved();
        }

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

        // Apply late fees if behind schedule (x402-aware: based on cumulative shortfall)
        if (lateFeeBps > 0 && nextPaymentDue > 0 && block.timestamp > nextPaymentDue) {
            uint256 lateFee = calculateLateFee();
            if (lateFee > 0) {
                totalToRepay += lateFee;
                totalLateFees += lateFee;
                emit LateFeeApplied(lateFee, totalLateFees);
            }
            // Advance nextPaymentDue past current time
            while (nextPaymentDue > 0 && nextPaymentDue <= block.timestamp) {
                nextPaymentDue += REPAYMENT_INTERVAL;
            }
        }

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

    function markDefault() external {
        if (state != VaultState.Active && state != VaultState.Repaying)
            revert Errors.InvalidVaultState();
        // Permissionless when default conditions are met; admin can always force default
        if (!shouldDefault() && msg.sender != admin) revert Errors.DefaultConditionsNotMet();

        VaultState oldState = state;
        state = VaultState.Defaulted;
        emit VaultStateChanged(oldState, VaultState.Defaulted);
        emit VaultDefaulted(block.timestamp);
    }

    function autoCancelExpired() external {
        if (state != VaultState.Fundraising) revert Errors.InvalidVaultState();
        if (fundraisingDeadline == 0 || block.timestamp <= fundraisingDeadline)
            revert Errors.FundraisingNotExpired();
        if (totalRaised >= (targetAmount * 80) / 100)
            revert Errors.FundraisingAboveThreshold();

        VaultState oldState = state;
        state = VaultState.Cancelled;
        emit VaultStateChanged(oldState, VaultState.Cancelled);
        emit VaultCancelled(block.timestamp);
    }

    function completeFundraisingManual() external onlyAdmin inState(VaultState.Fundraising) {
        if (totalRaised < (targetAmount * 80) / 100)
            revert Errors.FundraisingThresholdNotMet();

        _activate();
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

    /// @notice x402-aware late fee: based on cumulative repayment shortfall
    function calculateLateFee() public view returns (uint256) {
        if (lateFeeBps == 0 || nextPaymentDue == 0) return 0;
        if (block.timestamp <= nextPaymentDue) return 0;

        uint256 daysLate = (block.timestamp - nextPaymentDue) / 1 days;
        if (daysLate == 0) return 0;
        // Cap to one period to prevent quadratic compounding across multiple missed periods.
        // Each missed period gets its own fee charge when nextPaymentDue advances.
        if (daysLate > REPAYMENT_INTERVAL / 1 days) {
            daysLate = REPAYMENT_INTERVAL / 1 days;
        }

        // Calculate expected cumulative repayment by now
        uint256 periodsElapsed = 0;
        if (activatedAt > 0 && REPAYMENT_INTERVAL > 0) {
            periodsElapsed = (block.timestamp - activatedAt) / REPAYMENT_INTERVAL;
        }
        uint256 expectedCumulative = periodsElapsed * expectedRepaymentPerPeriod;
        if (expectedCumulative > totalToRepay) expectedCumulative = totalToRepay;

        // Shortfall = how much behind schedule
        uint256 shortfall = totalRepaid >= expectedCumulative ? 0 : expectedCumulative - totalRepaid;
        if (shortfall == 0) return 0;

        return (shortfall * lateFeeBps * daysLate) / 10_000;
    }

    function shouldDefault() public view returns (bool) {
        if (state != VaultState.Active && state != VaultState.Repaying) return false;
        if (nextPaymentDue == 0 || gracePeriodSeconds == 0) return false;
        return block.timestamp > nextPaymentDue + gracePeriodSeconds;
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

        // Set up repayment schedule for late fee tracking
        if (lateFeeBps > 0 && durationSeconds >= REPAYMENT_INTERVAL) {
            nextPaymentDue = block.timestamp + REPAYMENT_INTERVAL;
            uint256 numberOfPeriods = durationSeconds / REPAYMENT_INTERVAL;
            expectedRepaymentPerPeriod = numberOfPeriods > 0 ? totalToRepay / numberOfPeriods : totalToRepay;
        }

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
