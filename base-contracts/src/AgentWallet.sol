// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentWallet} from "./interfaces/IAgentWallet.sol";
import {Errors} from "./libraries/Errors.sol";

/// @title AgentWallet — Human-controlled, AI-operated smart wallet with spending limits
/// @notice Owner (human) sets limits and controls. Operator (AI agent) executes payments.
contract AgentWallet is IAgentWallet, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    address public owner;
    address public operator;

    uint256 public dailyLimit;
    uint256 public perTxLimit;
    uint256 public spentToday;
    uint256 public dayStartTimestamp;

    mapping(address => bool) public whitelisted;
    bool public whitelistEnabled;

    address public creditVault;
    bool public frozen;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Errors.Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Errors.Unauthorized();
        _;
    }

    modifier notFrozen() {
        if (frozen) revert Errors.VaultPaused();
        _;
    }

    constructor(
        address _usdc,
        address _owner,
        address _operator,
        uint256 _dailyLimit,
        uint256 _perTxLimit
    ) {
        if (_usdc == address(0) || _owner == address(0)) revert Errors.ZeroAddress();
        usdc = IERC20(_usdc);
        owner = _owner;
        operator = _operator;
        dailyLimit = _dailyLimit;
        perTxLimit = _perTxLimit;
        dayStartTimestamp = block.timestamp;
    }

    // ─── Operator Functions ──────────────────────────────────────

    /// @notice Transfer USDC from this wallet — only operator, enforces limits
    function transfer(address to, uint256 amount) external onlyOperator notFrozen nonReentrant {
        if (amount == 0) revert Errors.InvalidAmount();
        if (to == address(0)) revert Errors.ZeroAddress();

        // Whitelist check
        if (whitelistEnabled && !whitelisted[to]) revert Errors.Unauthorized();

        // Per-tx limit
        if (perTxLimit > 0 && amount > perTxLimit) revert Errors.PaymentTooLarge();

        // Daily limit (reset if new day)
        _resetDailyIfNeeded();
        if (dailyLimit > 0 && spentToday + amount > dailyLimit) revert Errors.PaymentTooLarge();

        spentToday += amount;
        usdc.safeTransfer(to, amount);

        emit PaymentExecuted(to, amount);
    }

    // ─── Owner Functions ─────────────────────────────────────────

    function setOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert Errors.ZeroAddress();
        address old = operator;
        operator = newOperator;
        emit OperatorSet(old, newOperator);
    }

    function setLimits(uint256 newDailyLimit, uint256 newPerTxLimit) external onlyOwner {
        dailyLimit = newDailyLimit;
        perTxLimit = newPerTxLimit;
        emit LimitsUpdated(newDailyLimit, newPerTxLimit);
    }

    function setWhitelist(address recipient, bool allowed) external onlyOwner {
        whitelisted[recipient] = allowed;
        emit WhitelistUpdated(recipient, allowed);
    }

    function toggleWhitelist(bool enabled) external onlyOwner {
        whitelistEnabled = enabled;
        emit WhitelistToggled(enabled);
    }

    function linkCreditVault(address vault) external onlyOwner {
        creditVault = vault;
        emit CreditVaultLinked(vault);
    }

    function freeze() external onlyOwner {
        frozen = true;
        emit Frozen(msg.sender);
    }

    function unfreeze() external onlyOwner {
        frozen = false;
        emit Unfrozen(msg.sender);
    }

    /// @notice Emergency withdraw all USDC — only owner
    function emergencyWithdraw(address to) external onlyOwner {
        if (to == address(0)) revert Errors.ZeroAddress();
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert Errors.InsufficientBalance();
        usdc.safeTransfer(to, balance);
        emit EmergencyWithdrawal(to, balance);
    }

    // ─── Internal ────────────────────────────────────────────────

    function _resetDailyIfNeeded() internal {
        // Reset daily counter every 24 hours
        if (block.timestamp >= dayStartTimestamp + 1 days) {
            spentToday = 0;
            dayStartTimestamp = block.timestamp;
        }
    }

    // ─── View ────────────────────────────────────────────────────

    function getRemainingDaily() external view returns (uint256) {
        if (dailyLimit == 0) return type(uint256).max;
        if (block.timestamp >= dayStartTimestamp + 1 days) return dailyLimit;
        if (spentToday >= dailyLimit) return 0;
        return dailyLimit - spentToday;
    }
}
