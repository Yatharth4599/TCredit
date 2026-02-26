// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentRegistry {
    struct Agent {
        address wallet;
        string metadataURI;
        uint256 registeredAt;
        uint256 totalPaymentsReceived;
        uint256 totalPaymentsSent;
        bool hasActiveCreditLine;
        address vault;
        bool active;
    }

    event AgentRegistered(address indexed wallet, string metadataURI);
    event AgentUpdated(address indexed wallet, string metadataURI);
    event VaultLinked(address indexed wallet, address indexed vault);
    event AgentDeactivated(address indexed wallet);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);
    event PaymentRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event AdminTransferProposed(address indexed current, address indexed proposed);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    function registerAgent(string calldata metadataURI) external;
    function updateMetadata(string calldata metadataURI) external;
    function linkVault(address agent, address vault) external;
    function incrementPaymentsSent(address agent, uint256 amount) external;
    function incrementPaymentsReceived(address agent, uint256 amount) external;
    function setFactory(address _factory) external;
    function setPaymentRouter(address _router) external;
    function deactivateAgent(address agent) external;
    function proposeAdmin(address _newAdmin) external;
    function acceptAdmin() external;
    function getAgent(address wallet) external view returns (Agent memory);
    function isRegistered(address wallet) external view returns (bool);
    function hasActiveCreditLine(address wallet) external view returns (bool);
    function getVault(address wallet) external view returns (address);
    function getAllAgents() external view returns (address[] memory);
    function getAgentCount() external view returns (uint256);
}
