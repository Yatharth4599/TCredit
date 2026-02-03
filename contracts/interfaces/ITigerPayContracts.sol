// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDebtToken
 * @notice Interface for debt tokens representing fractional vault ownership
 */
interface IDebtToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function pause() external;
    function unpause() external;
    function addToWhitelist(address account) external;
    function removeFromWhitelist(address account) external;
}

/**
 * @title IMerchantVault
 * @notice Interface for merchant fundraising vaults
 */
interface IMerchantVault {
    enum VaultState { FUNDRAISING, ACTIVE, REPAYING, COMPLETED, DEFAULTED }
    
    function invest(uint256 amount) external;
    function releaseTranche(uint256 trancheIndex) external;
    function makeRepayment(uint256 amount) external;
    function claimReturns() external;
    function getVaultState() external view returns (VaultState);
}

/**
 * @title IVaultFactory
 * @notice Interface for vault factory
 */
interface IVaultFactory {
    function createVault(
        address merchant,
        uint256 targetAmount,
        uint256 interestRate,
        uint256 duration
    ) external returns (address);
    
    function getVaultsByMerchant(address merchant) external view returns (address[] memory);
    function getAllVaults() external view returns (address[] memory);
}

/**
 * @title IMilestoneOracle
 * @notice Interface for milestone verification oracle
 */
interface IMilestoneOracle {
    function submitMilestone(
        address vault,
        uint256 milestoneId,
        bytes calldata proof
    ) external;
    
    function approveMilestone(
        address vault,
        uint256 milestoneId
    ) external;
    
    function isMilestoneApproved(
        address vault,
        uint256 milestoneId
    ) external view returns (bool);
}

/**
 * @title IPaymentProcessor
 * @notice Interface for repayment processing
 */
interface IPaymentProcessor {
    struct PaymentSchedule {
        uint256 amount;
        uint256 dueDate;
        bool paid;
    }
    
    function processRepayment(
        address vault,
        uint256 amount
    ) external;
    
    function calculatePenalty(
        address vault,
        uint256 scheduleIndex
    ) external view returns (uint256);
    
    function getPaymentSchedule(
        address vault
    ) external view returns (PaymentSchedule[] memory);
}
