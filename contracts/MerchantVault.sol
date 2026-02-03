// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./DebtToken.sol";
import "./MilestoneOracle.sol";

/**
 * @title MerchantVault
 * @notice Manages merchant fundraising lifecycle from investment to repayment
 * @dev Lifecycle: FUNDRAISING → ACTIVE → REPAYING → COMPLETED | DEFAULTED
 */
contract MerchantVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============ Enums ============
    enum VaultState { FUNDRAISING, ACTIVE, REPAYING, COMPLETED, DEFAULTED }

    // ============ Structs ============
    struct VaultConfig {
        uint256 targetAmount;       // Total fundraising target
        uint256 minInvestment;      // Minimum investment per investor
        uint256 maxInvestment;      // Maximum investment per investor
        uint256 interestRateBps;    // Annual interest rate in basis points (e.g., 1500 = 15%)
        uint256 durationMonths;     // Loan duration in months
        uint256 fundraisingDeadline; // Deadline for fundraising
        uint256 numTranches;        // Number of tranches
    }

    struct Tranche {
        uint256 amount;             // Amount in this tranche
        uint256 releaseTime;        // Earliest release time
        bool released;              // Whether tranche has been released
        uint256 milestoneId;        // Associated milestone ID (0 for no milestone)
    }

    struct RepaymentSchedule {
        uint256 amount;             // Expected payment amount
        uint256 dueDate;            // Payment due date
        uint256 paidAmount;         // Amount actually paid
        bool completed;             // Whether payment is complete
    }

    address public immutable merchant;
    address public immutable fundingToken;
    DebtToken public debtToken;
    MilestoneOracle public milestoneOracle;
    
    VaultConfig public config;
    
    VaultState public state;
    uint256 public totalRaised;
    uint256 public totalRepaid;
    uint256 public totalToRepay;
    uint256 public createdAt;
    Tranche[] public tranches;
    uint256 public tranchesReleased;
    RepaymentSchedule[] public repaymentSchedule;
    uint256 public currentRepaymentIndex;
    mapping(address => uint256) public investments;
    mapping(address => uint256) public claimedReturns;
    address[] public investors;
    
    uint256 public constant PLATFORM_FEE_BPS = 200;
    address public platformFeeRecipient;
    uint256 public platformFeesCollected;
    
    event VaultCreated(
        address indexed merchant,
        uint256 targetAmount,
        uint256 interestRateBps,
        uint256 durationMonths
    );
    
    event InvestmentMade(
        address indexed investor,
        uint256 amount,
        uint256 tokensReceived
    );
    
    event FundraisingCompleted(uint256 totalRaised, uint256 timestamp);
    
    event TrancheReleased(
        uint256 indexed trancheIndex,
        uint256 amount,
        address indexed merchant
    );
    
    event RepaymentReceived(
        uint256 indexed scheduleIndex,
        uint256 amount,
        uint256 timestamp
    );
    
    event ReturnsClaimd(
        address indexed investor,
        uint256 amount
    );
    
    event VaultStateChanged(VaultState oldState, VaultState newState);
    
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    // ============ Errors ============
    
    error InvalidState(VaultState current, VaultState required);
    error FundraisingDeadlinePassed();
    error InvestmentTooLow(uint256 amount, uint256 minimum);
    error InvestmentTooHigh(uint256 amount, uint256 maximum);
    error TargetExceeded(uint256 wouldRaise, uint256 target);
    error TrancheNotReady(uint256 trancheIndex);
    error TrancheAlreadyReleased(uint256 trancheIndex);
    error MilestoneNotApproved(uint256 milestoneId);
    error NoReturnsAvailable();
    error InvalidAmount();
    error ZeroAddress();
    error InvalidConfiguration();
    error FundraisingNotComplete();

    // ============ Modifiers ============
    
    modifier onlyState(VaultState required) {
        if (state != required) revert InvalidState(state, required);
        _;
    }
    
    modifier onlyMerchant() {
        require(msg.sender == merchant, "Only merchant");
        _;
    }

    // ============ Constructor ============
    
    /**
     * @notice Creates a new MerchantVault
     * @param _merchant Merchant wallet address
     * @param _fundingToken Stablecoin token address (USDC/USDT)
     * @param _admin Platform admin address
     * @param _feeRecipient Platform fee recipient
     * @param _config Vault configuration
     * @param _tokenName Debt token name
     * @param _tokenSymbol Debt token symbol
     */
    constructor(
        address _merchant,
        address _fundingToken,
        address _milestoneOracle,
        address _admin,
        address _feeRecipient,
        VaultConfig memory _config,
        string memory _tokenName,
        string memory _tokenSymbol
    ) {
        if (_merchant == address(0)) revert ZeroAddress();
        if (_fundingToken == address(0)) revert ZeroAddress();
        if (_milestoneOracle == address(0)) revert ZeroAddress();
        if (_admin == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_config.targetAmount == 0) revert InvalidConfiguration();
        if (_config.interestRateBps == 0 || _config.interestRateBps > 5000) revert InvalidConfiguration();
        if (_config.durationMonths == 0 || _config.durationMonths > 60) revert InvalidConfiguration();
        if (_config.numTranches == 0 || _config.numTranches > 12) revert InvalidConfiguration();
        if (_config.fundraisingDeadline <= block.timestamp) revert InvalidConfiguration();
        
        merchant = _merchant;
        fundingToken = _fundingToken;
        milestoneOracle = MilestoneOracle(_milestoneOracle);
        platformFeeRecipient = _feeRecipient;
        config = _config;
        state = VaultState.FUNDRAISING;
        createdAt = block.timestamp;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        
        debtToken = new DebtToken(_tokenName, _tokenSymbol, address(this), _admin);
        
        _initializeTranches();
        
        emit VaultCreated(_merchant, _config.targetAmount, _config.interestRateBps, _config.durationMonths);
    }

    // ============ External Functions ============
    
    /**
     * @notice Invest in the vault (during FUNDRAISING state)
     * @param amount Amount of funding tokens to invest
     */
    function invest(uint256 amount) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyState(VaultState.FUNDRAISING) 
    {
        if (block.timestamp > config.fundraisingDeadline) {
            revert FundraisingDeadlinePassed();
        }
        if (amount < config.minInvestment) {
            revert InvestmentTooLow(amount, config.minInvestment);
        }
        if (investments[msg.sender] + amount > config.maxInvestment) {
            revert InvestmentTooHigh(investments[msg.sender] + amount, config.maxInvestment);
        }
        if (totalRaised + amount > config.targetAmount) {
            revert TargetExceeded(totalRaised + amount, config.targetAmount);
        }
        
        // Transfer tokens from investor
        IERC20(fundingToken).safeTransferFrom(msg.sender, address(this), amount);
        
        // Track investment
        if (investments[msg.sender] == 0) {
            investors.push(msg.sender);
        }
        investments[msg.sender] += amount;
        totalRaised += amount;
        
        // Mint debt tokens 1:1 with investment
        debtToken.mint(msg.sender, amount);
        
        emit InvestmentMade(msg.sender, amount, amount);
        
        // Check if fundraising is complete
        if (totalRaised >= config.targetAmount) {
            _completeFundraising();
        }
    }
    
    /**
     * @notice Complete fundraising manually (only if minimum threshold reached)
     * @dev Can be called by operator if target reached or deadline passed
     */
    function completeFundraising() 
        external 
        onlyRole(OPERATOR_ROLE) 
        onlyState(VaultState.FUNDRAISING) 
    {
        // Require at least 80% of target raised
        if (totalRaised < (config.targetAmount * 80) / 100) {
            revert FundraisingNotComplete();
        }
        _completeFundraising();
    }
    
    /**
     * @notice Release a tranche to the merchant
     * @param trancheIndex Index of the tranche to release
     */
    function releaseTranche(uint256 trancheIndex) external nonReentrant onlyRole(OPERATOR_ROLE) {
        require(state == VaultState.ACTIVE || state == VaultState.REPAYING, "Invalid state");
        require(trancheIndex < tranches.length, "Invalid tranche");
        
        Tranche storage tranche = tranches[trancheIndex];
        
        if (tranche.released) revert TrancheAlreadyReleased(trancheIndex);
        if (block.timestamp < tranche.releaseTime) revert TrancheNotReady(trancheIndex);
        
        if (!milestoneOracle.isMilestoneApproved(address(this), tranche.milestoneId)) {
            revert MilestoneNotApproved(tranche.milestoneId);
        }
        
        tranche.released = true;
        tranchesReleased++;
        
        // Transfer to merchant (minus platform fee)
        uint256 fee = (tranche.amount * PLATFORM_FEE_BPS) / 10000;
        uint256 merchantAmount = tranche.amount - fee;
        
        IERC20(fundingToken).safeTransfer(merchant, merchantAmount);
        IERC20(fundingToken).safeTransfer(platformFeeRecipient, fee);
        platformFeesCollected += fee;
        
        emit TrancheReleased(trancheIndex, merchantAmount, merchant);
        
        // If all tranches released, move to REPAYING state
        if (tranchesReleased >= tranches.length && state == VaultState.ACTIVE) {
            _changeState(VaultState.REPAYING);
        }
    }
    
    /**
     * @notice Merchant makes a repayment
     * @param amount Amount to repay
     */
    function makeRepayment(uint256 amount) 
        external 
        nonReentrant 
        onlyMerchant 
    {
        require(state == VaultState.ACTIVE || state == VaultState.REPAYING, "Cannot repay now");
        if (amount == 0) revert InvalidAmount();
        
        // Transfer repayment from merchant
        IERC20(fundingToken).safeTransferFrom(msg.sender, address(this), amount);
        
        totalRepaid += amount;
        
        // Update repayment schedule
        uint256 remaining = amount;
        while (remaining > 0 && currentRepaymentIndex < repaymentSchedule.length) {
            RepaymentSchedule storage schedule = repaymentSchedule[currentRepaymentIndex];
            uint256 needed = schedule.amount - schedule.paidAmount;
            
            if (remaining >= needed) {
                schedule.paidAmount = schedule.amount;
                schedule.completed = true;
                remaining -= needed;
                currentRepaymentIndex++;
            } else {
                schedule.paidAmount += remaining;
                remaining = 0;
            }
        }
        
        emit RepaymentReceived(currentRepaymentIndex, amount, block.timestamp);
        
        // Check if fully repaid
        if (totalRepaid >= totalToRepay) {
            _changeState(VaultState.COMPLETED);
        }
    }
    
    /**
     * @notice Investor claims their share of returns
     */
    function claimReturns() external nonReentrant {
        require(state == VaultState.REPAYING || state == VaultState.COMPLETED, "Cannot claim yet");
        
        uint256 owedAmount = _calculateClaimableReturns(msg.sender);
        if (owedAmount == 0) revert NoReturnsAvailable();
        
        claimedReturns[msg.sender] += owedAmount;
        
        IERC20(fundingToken).safeTransfer(msg.sender, owedAmount);
        
        emit ReturnsClaimd(msg.sender, owedAmount);
    }
    
    /**
     * @notice Mark vault as defaulted
     * @dev Only callable by operator after grace period
     */
    function markDefaulted() 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        require(state == VaultState.ACTIVE || state == VaultState.REPAYING, "Cannot default");
        
        // Check if overdue
        if (currentRepaymentIndex < repaymentSchedule.length) {
            RepaymentSchedule storage schedule = repaymentSchedule[currentRepaymentIndex];
            require(block.timestamp > schedule.dueDate + 30 days, "Not overdue yet");
        }
        
        _changeState(VaultState.DEFAULTED);
    }
    
    /**
     * @notice Emergency withdrawal for failed fundraising
     */
    function emergencyRefund() 
        external 
        nonReentrant 
        onlyState(VaultState.FUNDRAISING) 
    {
        require(block.timestamp > config.fundraisingDeadline, "Fundraising not ended");
        require(totalRaised < (config.targetAmount * 80) / 100, "Fundraising succeeded");
        
        uint256 investment = investments[msg.sender];
        require(investment > 0, "No investment");
        
        investments[msg.sender] = 0;
        
        IERC20(fundingToken).safeTransfer(msg.sender, investment);
        
        emit EmergencyWithdrawal(msg.sender, investment);
    }
    
    /**
     * @notice Pause the vault
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the vault
     */
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // ============ View Functions ============
    
    /**
     * @notice Get current vault state
     */
    function getVaultState() external view returns (VaultState) {
        return state;
    }
    
    /**
     * @notice Get vault configuration
     */
    function getConfig() external view returns (VaultConfig memory) {
        return config;
    }
    
    /**
     * @notice Get all tranches
     */
    function getTranches() external view returns (Tranche[] memory) {
        return tranches;
    }
    
    /**
     * @notice Get repayment schedule
     */
    function getRepaymentSchedule() external view returns (RepaymentSchedule[] memory) {
        return repaymentSchedule;
    }
    
    /**
     * @notice Calculate claimable returns for an investor
     */
    function getClaimableReturns(address investor) external view returns (uint256) {
        return _calculateClaimableReturns(investor);
    }
    
    /**
     * @notice Get investor count
     */
    function getInvestorCount() external view returns (uint256) {
        return investors.length;
    }
    
    /**
     * @notice Get vault summary
     */
    function getVaultSummary() external view returns (
        VaultState currentState,
        uint256 raised,
        uint256 target,
        uint256 repaid,
        uint256 repaymentTarget,
        uint256 investorCount
    ) {
        return (
            state,
            totalRaised,
            config.targetAmount,
            totalRepaid,
            totalToRepay,
            investors.length
        );
    }

    // ============ Internal Functions ============
    
    function _initializeTranches() internal {
        uint256 trancheAmount = config.targetAmount / config.numTranches;
        
        for (uint256 i = 0; i < config.numTranches; i++) {
            tranches.push(Tranche({
                amount: trancheAmount,
                releaseTime: 0,
                released: false,
                milestoneId: i + 1
            }));
        }
    }
    
    function _completeFundraising() internal {
        _changeState(VaultState.ACTIVE);
        
        // Calculate total repayment (principal + interest)
        uint256 interest = (totalRaised * config.interestRateBps * config.durationMonths) / (10000 * 12);
        totalToRepay = totalRaised + interest;
        
        // Set tranche release times
        uint256 trancheInterval = 30 days;
        for (uint256 i = 0; i < tranches.length; i++) {
            tranches[i].releaseTime = block.timestamp + (i * trancheInterval);
            // Adjust tranche amount based on actual amount raised
            tranches[i].amount = totalRaised / tranches.length;
        }
        
        // Initialize repayment schedule (monthly payments)
        uint256 monthlyPayment = totalToRepay / config.durationMonths;
        for (uint256 i = 0; i < config.durationMonths; i++) {
            repaymentSchedule.push(RepaymentSchedule({
                amount: monthlyPayment,
                dueDate: block.timestamp + ((i + 1) * 30 days),
                paidAmount: 0,
                completed: false
            }));
        }
        
        emit FundraisingCompleted(totalRaised, block.timestamp);
    }
    
    function _calculateClaimableReturns(address investor) internal view returns (uint256) {
        if (investments[investor] == 0) return 0;
        
        // Calculate proportional share of repayments
        uint256 sharePercentage = (investments[investor] * 1e18) / totalRaised;
        uint256 totalOwed = (totalRepaid * sharePercentage) / 1e18;
        
        // Subtract already claimed
        if (totalOwed <= claimedReturns[investor]) return 0;
        return totalOwed - claimedReturns[investor];
    }
    
    function _changeState(VaultState newState) internal {
        VaultState oldState = state;
        state = newState;
        emit VaultStateChanged(oldState, newState);
    }
}
