// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IMerchantVault {
    enum VaultState {
        Fundraising,
        Active,
        Repaying,
        Completed,
        Defaulted,
        Cancelled
    }

    event Invested(address indexed investor, uint256 amount, uint256 totalRaised);
    event TrancheReleased(uint256 indexed trancheNum, uint256 amount, address indexed agent);
    event RepaymentProcessed(uint256 amount, uint256 seniorPay, uint256 poolPay, uint256 communityPay);
    event WaterfallDistributed(uint256 seniorPayment, uint256 poolPayment, uint256 communityPayment);
    event ReturnsClaimed(address indexed investor, uint256 amount);
    event VaultStateChanged(VaultState oldState, VaultState newState);
    event VaultPaused();
    event VaultUnpaused();
    event VaultDefaulted(uint256 timestamp);
    event VaultCancelled(uint256 timestamp);

    function invest(uint256 amount) external;
    function investSenior(uint256 amount) external;
    function investFromPool(uint256 amount) external;
    function processRepayment(uint256 amount) external;
    function claimReturns() external;
    function releaseTranche() external;
    function pause() external;
    function unpause() external;
    function markDefault() external;
    function cancel() external;
    function claimRefund() external;

    function getAgent() external view returns (address);
    function getState() external view returns (VaultState);
    function getTotalRaised() external view returns (uint256);
    function getTotalRepaid() external view returns (uint256);
    function getTotalToRepay() external view returns (uint256);
    function getInvestorBalance(address investor) external view returns (uint256);
    function getClaimable(address investor) external view returns (uint256);
}
