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

    function registerAgent(string calldata metadataURI) external;
    function updateMetadata(string calldata metadataURI) external;
    function linkVault(address agent, address vault) external;
    function incrementPaymentsSent(address agent, uint256 amount) external;
    function incrementPaymentsReceived(address agent, uint256 amount) external;
    function getAgent(address wallet) external view returns (Agent memory);
    function isRegistered(address wallet) external view returns (bool);
    function hasActiveCreditLine(address wallet) external view returns (bool);
    function getVault(address wallet) external view returns (address);
}
