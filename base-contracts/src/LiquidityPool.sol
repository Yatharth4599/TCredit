// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IMerchantVault} from "./interfaces/IMerchantVault.sol";
import {ILiquidityPool} from "./interfaces/ILiquidityPool.sol";
import {Errors} from "./libraries/Errors.sol";

/// @title LiquidityPool — LP capital management for vault funding
/// @notice LPs deposit USDC, admin allocates to vaults, returns flow back
contract LiquidityPool is ILiquidityPool, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public admin;

    uint256 public totalDeposits;
    uint256 public totalAllocated;
    bool public paused;
    bool public isAlpha; // senior pool flag
    uint256 public maxAllocationPerVault;

    mapping(address => uint256) public depositorBalances;
    mapping(address => PoolAllocation) private _allocations;
    address[] public allocatedVaults;

    address public pendingAdmin;

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Errors.Unauthorized();
        _;
    }

    modifier notPaused() {
        if (paused) revert Errors.PoolPaused();
        _;
    }

    constructor(address _usdc, address _admin, bool _isAlpha, uint256 _maxAllocPerVault) {
        if (_usdc == address(0) || _admin == address(0)) revert Errors.ZeroAddress();

        usdc = IERC20(_usdc);
        admin = _admin;
        isAlpha = _isAlpha;
        maxAllocationPerVault = _maxAllocPerVault;
    }

    // ─── Deposit / Withdraw ──────────────────────────────────────

    function deposit(uint256 amount) external nonReentrant notPaused {
        if (amount == 0) revert Errors.InvalidAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        depositorBalances[msg.sender] += amount;
        totalDeposits += amount;

        emit Deposited(msg.sender, amount, totalDeposits);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert Errors.InvalidAmount();
        if (depositorBalances[msg.sender] < amount) revert Errors.InsufficientBalance();

        uint256 available = totalDeposits - totalAllocated;
        if (amount > available) revert Errors.InsufficientPoolBalance();

        depositorBalances[msg.sender] -= amount;
        totalDeposits -= amount;

        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ─── Vault Allocation ────────────────────────────────────────

    function allocateToVault(address vault, uint256 amount) external onlyAdmin notPaused nonReentrant {
        if (vault == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.InvalidAmount();

        uint256 available = totalDeposits - totalAllocated;
        if (amount > available) revert Errors.InsufficientPoolBalance();

        if (maxAllocationPerVault > 0 && amount > maxAllocationPerVault)
            revert Errors.ExceedsMaxAllocation();

        if (!_allocations[vault].active) {
            allocatedVaults.push(vault);
        }

        _allocations[vault] = PoolAllocation({
            amount: _allocations[vault].amount + amount,
            returnedAmount: _allocations[vault].returnedAmount,
            allocatedAt: block.timestamp,
            active: true
        });
        totalAllocated += amount;

        // Invest into vault (as pool tranche)
        usdc.forceApprove(vault, amount);
        if (isAlpha) {
            IMerchantVault(vault).investSenior(amount);
        } else {
            IMerchantVault(vault).investFromPool(amount);
        }

        emit AllocatedToVault(vault, amount);
    }

    // ─── Return Processing ───────────────────────────────────────

    function processReturn(address vault, uint256 amount) external nonReentrant {
        if (!_allocations[vault].active) revert Errors.AllocationNotFound();
        if (amount == 0) revert Errors.InvalidAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        _allocations[vault].returnedAmount += amount;
        if (totalAllocated < amount) revert Errors.ArithmeticOverflow();
        totalAllocated -= amount;

        // Deactivate if fully returned
        if (_allocations[vault].returnedAmount >= _allocations[vault].amount) {
            _allocations[vault].active = false;
        }

        emit ReturnProcessed(vault, amount);
    }

    // ─── Admin ───────────────────────────────────────────────────

    function pause() external onlyAdmin {
        paused = true;
        emit PoolPaused();
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit PoolUnpaused();
    }

    function setMaxAllocation(uint256 _max) external onlyAdmin {
        uint256 old = maxAllocationPerVault;
        maxAllocationPerVault = _max;
        emit MaxAllocationUpdated(old, _max);
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

    // ─── View ────────────────────────────────────────────────────

    function getDepositorBalance(address depositor) external view returns (uint256) {
        return depositorBalances[depositor];
    }

    function getAllocation(address vault) external view returns (PoolAllocation memory) {
        return _allocations[vault];
    }

    function getTotalDeposits() external view returns (uint256) {
        return totalDeposits;
    }

    function getAvailableBalance() external view returns (uint256) {
        return totalDeposits - totalAllocated;
    }

    function getAllocatedVaults() external view returns (address[] memory) {
        return allocatedVaults;
    }
}
