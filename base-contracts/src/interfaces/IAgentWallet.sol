// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentWallet {
    event OperatorSet(address indexed oldOperator, address indexed newOperator);
    event LimitsUpdated(uint256 dailyLimit, uint256 perTxLimit);
    event WhitelistUpdated(address indexed recipient, bool allowed);
    event WhitelistToggled(bool enabled);
    event CreditVaultLinked(address indexed vault);
    event Frozen(address indexed by);
    event Unfrozen(address indexed by);
    event PaymentExecuted(address indexed to, uint256 amount);
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    function owner() external view returns (address);
    function operator() external view returns (address);
    function dailyLimit() external view returns (uint256);
    function perTxLimit() external view returns (uint256);
    function spentToday() external view returns (uint256);
    function frozen() external view returns (bool);
    function whitelistEnabled() external view returns (bool);
    function creditVault() external view returns (address);

    // Operator functions
    function transfer(address to, uint256 amount) external;

    // Owner functions
    function setOperator(address newOperator) external;
    function setLimits(uint256 newDailyLimit, uint256 newPerTxLimit) external;
    function setWhitelist(address recipient, bool allowed) external;
    function toggleWhitelist(bool enabled) external;
    function linkCreditVault(address vault) external;
    function freeze() external;
    function unfreeze() external;
    function emergencyWithdraw(address to) external;
}
