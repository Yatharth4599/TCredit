// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {Errors} from "./libraries/Errors.sol";

/// @title AgentRegistry — On-chain identity for AI agents
/// @notice Permissionless self-registration. Every wallet is an agent.
contract AgentRegistry is IAgentRegistry {
    mapping(address => Agent) private _agents;
    address[] private _allAgents;

    address public factory;
    address public paymentRouter;
    address public admin;

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Errors.Unauthorized();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != factory && msg.sender != paymentRouter && msg.sender != admin)
            revert Errors.Unauthorized();
        _;
    }

    constructor(address _admin) {
        if (_admin == address(0)) revert Errors.ZeroAddress();
        admin = _admin;
    }

    function setFactory(address _factory) external onlyAdmin {
        if (_factory == address(0)) revert Errors.ZeroAddress();
        factory = _factory;
    }

    function setPaymentRouter(address _router) external onlyAdmin {
        if (_router == address(0)) revert Errors.ZeroAddress();
        paymentRouter = _router;
    }

    function registerAgent(string calldata metadataURI) external {
        if (_agents[msg.sender].registeredAt != 0) revert Errors.AgentAlreadyRegistered();
        if (bytes(metadataURI).length == 0) revert Errors.InvalidMetadata();

        _agents[msg.sender] = Agent({
            wallet: msg.sender,
            metadataURI: metadataURI,
            registeredAt: block.timestamp,
            totalPaymentsReceived: 0,
            totalPaymentsSent: 0,
            hasActiveCreditLine: false,
            vault: address(0),
            active: true
        });
        _allAgents.push(msg.sender);

        emit AgentRegistered(msg.sender, metadataURI);
    }

    function updateMetadata(string calldata metadataURI) external {
        if (_agents[msg.sender].registeredAt == 0) revert Errors.AgentNotRegistered();
        if (bytes(metadataURI).length == 0) revert Errors.InvalidMetadata();

        _agents[msg.sender].metadataURI = metadataURI;
        emit AgentUpdated(msg.sender, metadataURI);
    }

    function linkVault(address agent, address vault) external onlyAuthorized {
        if (_agents[agent].registeredAt == 0) revert Errors.AgentNotRegistered();
        if (vault == address(0)) revert Errors.ZeroAddress();

        _agents[agent].hasActiveCreditLine = true;
        _agents[agent].vault = vault;
        emit VaultLinked(agent, vault);
    }

    function incrementPaymentsSent(address agent, uint256 amount) external onlyAuthorized {
        _agents[agent].totalPaymentsSent += amount;
    }

    function incrementPaymentsReceived(address agent, uint256 amount) external onlyAuthorized {
        _agents[agent].totalPaymentsReceived += amount;
    }

    function deactivateAgent(address agent) external onlyAdmin {
        if (_agents[agent].registeredAt == 0) revert Errors.AgentNotRegistered();
        _agents[agent].active = false;
        emit AgentDeactivated(agent);
    }

    // ─── View Functions ──────────────────────────────────────────

    function getAgent(address wallet) external view returns (Agent memory) {
        return _agents[wallet];
    }

    function isRegistered(address wallet) external view returns (bool) {
        return _agents[wallet].registeredAt != 0;
    }

    function hasActiveCreditLine(address wallet) external view returns (bool) {
        return _agents[wallet].hasActiveCreditLine;
    }

    function getVault(address wallet) external view returns (address) {
        return _agents[wallet].vault;
    }

    function getAllAgents() external view returns (address[] memory) {
        return _allAgents;
    }

    function getAgentCount() external view returns (uint256) {
        return _allAgents.length;
    }
}
