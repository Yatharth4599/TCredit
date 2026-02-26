// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILiquidityPool {
    struct PoolAllocation {
        uint256 amount;
        uint256 returnedAmount;
        uint256 allocatedAt;
        bool active;
    }

    event Deposited(address indexed depositor, uint256 amount, uint256 totalDeposits);
    event Withdrawn(address indexed depositor, uint256 amount);
    event AllocatedToVault(address indexed vault, uint256 amount);
    event ReturnProcessed(address indexed vault, uint256 amount);
    event PoolPaused();
    event PoolUnpaused();

    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function allocateToVault(address vault, uint256 amount) external;
    function processReturn(address vault, uint256 amount) external;
    function getDepositorBalance(address depositor) external view returns (uint256);
    function getAllocation(address vault) external view returns (PoolAllocation memory);
    function getTotalDeposits() external view returns (uint256);
    function getAvailableBalance() external view returns (uint256);
}
