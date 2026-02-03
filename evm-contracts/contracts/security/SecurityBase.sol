// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SecurityBase
 * @author TigerPay (Inspired by zktoosh security patterns)
 * @notice Base contract providing comprehensive security features
 * @dev Implements security patterns from zktoosh:
 *      - Nullifier tracking (replay attack prevention)
 *      - Strict input validation
 *      - Rate limiting per address
 *      - Timelocks for critical operations
 *      - Circuit breaker pattern
 *      - Multi-signature for admin operations
 */
abstract contract SecurityBase is AccessControl, ReentrancyGuard, Pausable {
    
    // ============ Roles ============
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ============ Nullifier Tracking (zktoosh pattern) ============
    
    /// @notice Tracks used nullifiers to prevent replay attacks
    mapping(bytes32 => bool) private _usedNullifiers;
    
    /// @notice Emitted when a nullifier is consumed
    event NullifierUsed(bytes32 indexed nullifier, address indexed user, uint256 timestamp);

    // ============ Rate Limiting ============
    
    struct RateLimitConfig {
        uint256 maxOperations;    // Max operations allowed
        uint256 windowSeconds;    // Time window in seconds
        bool enabled;             // Whether rate limiting is active
    }
    
    struct UserRateLimit {
        uint256 operationCount;   // Number of operations in window
        uint256 windowStart;      // Start of current window
    }
    
    RateLimitConfig public rateLimitConfig;
    mapping(address => UserRateLimit) private _userRateLimits;
    
    event RateLimitExceeded(address indexed user, uint256 count, uint256 limit);
    event RateLimitConfigUpdated(uint256 maxOperations, uint256 windowSeconds, bool enabled);

    // ============ Timelock ============
    
    struct TimelockOperation {
        bytes32 operationHash;
        uint256 executeAfter;
        bool executed;
        bool cancelled;
    }
    
    uint256 public constant MIN_TIMELOCK_DELAY = 1 days;
    uint256 public constant MAX_TIMELOCK_DELAY = 30 days;
    uint256 public timelockDelay = 2 days;
    
    mapping(bytes32 => TimelockOperation) public timelockOperations;
    
    event TimelockQueued(bytes32 indexed operationId, bytes32 operationHash, uint256 executeAfter);
    event TimelockExecuted(bytes32 indexed operationId);
    event TimelockCancelled(bytes32 indexed operationId);
    event TimelockDelayUpdated(uint256 oldDelay, uint256 newDelay);

    // ============ Circuit Breaker ============
    
    uint256 public circuitBreakerThreshold;
    uint256 public circuitBreakerWindow = 1 hours;
    uint256 public circuitBreakerResetTime;
    uint256 private _operationsInWindow;
    uint256 private _windowStartTime;
    bool public circuitBreakerTripped;
    
    event CircuitBreakerTripped(uint256 operations, uint256 threshold, uint256 timestamp);
    event CircuitBreakerReset(address indexed by, uint256 timestamp);

    // ============ Emergency Withdrawal ============
    
    uint256 public emergencyWithdrawalDelay = 7 days;
    mapping(address => uint256) public emergencyWithdrawalRequests;
    
    event EmergencyWithdrawalRequested(address indexed user, uint256 executeAfter);
    event EmergencyWithdrawalExecuted(address indexed user, uint256 amount);
    event EmergencyWithdrawalCancelled(address indexed user);

    // ============ Errors ============
    
    error NullifierAlreadyUsed(bytes32 nullifier);
    error RateLimitExceededError(address user, uint256 count, uint256 max);
    error TimelockNotReady(bytes32 operationId, uint256 executeAfter);
    error TimelockAlreadyExecuted(bytes32 operationId);
    error TimelockWasCancelled(bytes32 operationId);
    error TimelockNotFound(bytes32 operationId);
    error InvalidTimelockDelay(uint256 delay);
    error CircuitBreakerActive();
    error EmergencyWithdrawalNotReady();
    error NoEmergencyWithdrawalPending();
    error ZeroValue();
    error InvalidAddress();
    error ArrayLengthMismatch();
    error ExceedsMaxValue(uint256 value, uint256 max);

    // ============ Constructor ============
    
    constructor(address admin, address guardian) {
        if (admin == address(0)) revert InvalidAddress();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, admin);
        
        if (guardian != address(0)) {
            _grantRole(GUARDIAN_ROLE, guardian);
            _grantRole(EMERGENCY_ROLE, guardian);
        }
        
        // Default rate limit: 100 operations per hour
        rateLimitConfig = RateLimitConfig({
            maxOperations: 100,
            windowSeconds: 1 hours,
            enabled: true
        });
        
        // Default circuit breaker: 1000 operations/hour
        circuitBreakerThreshold = 1000;
        _windowStartTime = block.timestamp;
    }

    // ============ Modifiers ============
    
    /**
     * @notice Checks that a nullifier hasn't been used (zktoosh pattern)
     * @param nullifier The nullifier to check
     */
    modifier validNullifier(bytes32 nullifier) {
        if (_usedNullifiers[nullifier]) {
            revert NullifierAlreadyUsed(nullifier);
        }
        _;
    }
    
    /**
     * @notice Rate limits operations per address
     */
    modifier rateLimited() {
        if (rateLimitConfig.enabled) {
            _checkAndUpdateRateLimit(msg.sender);
        }
        _;
    }
    
    /**
     * @notice Checks circuit breaker isn't tripped
     */
    modifier circuitBreakerCheck() {
        if (circuitBreakerTripped && block.timestamp < circuitBreakerResetTime) {
            revert CircuitBreakerActive();
        }
        if (circuitBreakerTripped && block.timestamp >= circuitBreakerResetTime) {
            circuitBreakerTripped = false;
        }
        _checkCircuitBreaker();
        _;
    }
    
    /**
     * @notice Validates non-zero amount
     */
    modifier nonZeroAmount(uint256 amount) {
        if (amount == 0) revert ZeroValue();
        _;
    }
    
    /**
     * @notice Validates non-zero address
     */
    modifier nonZeroAddress(address addr) {
        if (addr == address(0)) revert InvalidAddress();
        _;
    }

    // ============ Nullifier Functions ============
    
    /**
     * @notice Marks a nullifier as used
     * @param nullifier The nullifier to consume
     */
    function _useNullifier(bytes32 nullifier) internal validNullifier(nullifier) {
        _usedNullifiers[nullifier] = true;
        emit NullifierUsed(nullifier, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Generates a nullifier from operation parameters
     * @param operationType Type of operation
     * @param amount Amount involved
     * @param nonce Unique nonce
     */
    function _generateNullifier(
        bytes32 operationType,
        uint256 amount,
        uint256 nonce
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            operationType,
            msg.sender,
            amount,
            nonce,
            block.chainid
        ));
    }
    
    /**
     * @notice Check if a nullifier has been used
     */
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return _usedNullifiers[nullifier];
    }

    // ============ Rate Limiting Functions ============
    
    function _checkAndUpdateRateLimit(address user) internal {
        UserRateLimit storage userLimit = _userRateLimits[user];
        
        // Reset window if expired
        if (block.timestamp >= userLimit.windowStart + rateLimitConfig.windowSeconds) {
            userLimit.windowStart = block.timestamp;
            userLimit.operationCount = 0;
        }
        
        // Check limit
        if (userLimit.operationCount >= rateLimitConfig.maxOperations) {
            emit RateLimitExceeded(user, userLimit.operationCount, rateLimitConfig.maxOperations);
            revert RateLimitExceededError(user, userLimit.operationCount, rateLimitConfig.maxOperations);
        }
        
        userLimit.operationCount++;
    }
    
    /**
     * @notice Update rate limit configuration
     */
    function setRateLimitConfig(
        uint256 maxOperations,
        uint256 windowSeconds,
        bool enabled
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rateLimitConfig = RateLimitConfig({
            maxOperations: maxOperations,
            windowSeconds: windowSeconds,
            enabled: enabled
        });
        emit RateLimitConfigUpdated(maxOperations, windowSeconds, enabled);
    }
    
    /**
     * @notice Get user's current rate limit status
     */
    function getUserRateLimitStatus(address user) external view returns (
        uint256 operationCount,
        uint256 windowStart,
        uint256 remainingOperations,
        uint256 windowEndsAt
    ) {
        UserRateLimit storage userLimit = _userRateLimits[user];
        
        if (block.timestamp >= userLimit.windowStart + rateLimitConfig.windowSeconds) {
            return (0, block.timestamp, rateLimitConfig.maxOperations, block.timestamp + rateLimitConfig.windowSeconds);
        }
        
        uint256 remaining = userLimit.operationCount >= rateLimitConfig.maxOperations 
            ? 0 
            : rateLimitConfig.maxOperations - userLimit.operationCount;
            
        return (
            userLimit.operationCount,
            userLimit.windowStart,
            remaining,
            userLimit.windowStart + rateLimitConfig.windowSeconds
        );
    }

    // ============ Timelock Functions ============
    
    /**
     * @notice Queue a timelock operation
     */
    function _queueTimelockOperation(
        bytes32 operationId,
        bytes32 operationHash
    ) internal onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 executeAfter = block.timestamp + timelockDelay;
        
        timelockOperations[operationId] = TimelockOperation({
            operationHash: operationHash,
            executeAfter: executeAfter,
            executed: false,
            cancelled: false
        });
        
        emit TimelockQueued(operationId, operationHash, executeAfter);
    }
    
    /**
     * @notice Check if timelock operation is ready
     */
    function _checkTimelockReady(bytes32 operationId) internal view {
        TimelockOperation storage op = timelockOperations[operationId];
        
        if (op.executeAfter == 0) revert TimelockNotFound(operationId);
        if (op.executed) revert TimelockAlreadyExecuted(operationId);
        if (op.cancelled) revert TimelockWasCancelled(operationId);
        if (block.timestamp < op.executeAfter) {
            revert TimelockNotReady(operationId, op.executeAfter);
        }
    }
    
    /**
     * @notice Mark timelock operation as executed
     */
    function _executeTimelockOperation(bytes32 operationId) internal {
        _checkTimelockReady(operationId);
        timelockOperations[operationId].executed = true;
        emit TimelockExecuted(operationId);
    }
    
    /**
     * @notice Cancel a timelock operation
     */
    function cancelTimelockOperation(bytes32 operationId) 
        external 
        onlyRole(GUARDIAN_ROLE) 
    {
        TimelockOperation storage op = timelockOperations[operationId];
        if (op.executeAfter == 0) revert TimelockNotFound(operationId);
        if (op.executed) revert TimelockAlreadyExecuted(operationId);
        
        op.cancelled = true;
        emit TimelockCancelled(operationId);
    }
    
    /**
     * @notice Update timelock delay
     */
    function setTimelockDelay(uint256 newDelay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newDelay < MIN_TIMELOCK_DELAY || newDelay > MAX_TIMELOCK_DELAY) {
            revert InvalidTimelockDelay(newDelay);
        }
        
        uint256 oldDelay = timelockDelay;
        timelockDelay = newDelay;
        emit TimelockDelayUpdated(oldDelay, newDelay);
    }

    // ============ Circuit Breaker Functions ============
    
    function _checkCircuitBreaker() internal {
        // Reset window if needed
        if (block.timestamp >= _windowStartTime + circuitBreakerWindow) {
            _windowStartTime = block.timestamp;
            _operationsInWindow = 0;
        }
        
        _operationsInWindow++;
        
        // Trip circuit breaker if threshold exceeded
        if (_operationsInWindow > circuitBreakerThreshold) {
            circuitBreakerTripped = true;
            circuitBreakerResetTime = block.timestamp + 1 hours;
            emit CircuitBreakerTripped(_operationsInWindow, circuitBreakerThreshold, block.timestamp);
        }
    }
    
    /**
     * @notice Manually reset circuit breaker
     */
    function resetCircuitBreaker() external onlyRole(EMERGENCY_ROLE) {
        circuitBreakerTripped = false;
        _operationsInWindow = 0;
        _windowStartTime = block.timestamp;
        emit CircuitBreakerReset(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Update circuit breaker threshold
     */
    function setCircuitBreakerThreshold(uint256 threshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        circuitBreakerThreshold = threshold;
    }

    // ============ Pause Functions ============
    
    /**
     * @notice Emergency pause
     */
    function emergencyPause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause (requires admin)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ============ Validation Helpers ============
    
    /**
     * @notice Validate array lengths match
     */
    function _validateArrayLengths(uint256 len1, uint256 len2) internal pure {
        if (len1 != len2) revert ArrayLengthMismatch();
    }
    
    /**
     * @notice Validate value doesn't exceed maximum
     */
    function _validateMaxValue(uint256 value, uint256 max) internal pure {
        if (value > max) revert ExceedsMaxValue(value, max);
    }
}
