// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerchantVault} from "./MerchantVault.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IPaymentRouter} from "./interfaces/IPaymentRouter.sol";
import {Errors} from "./libraries/Errors.sol";

/// @title VaultFactory — CREATE2 deployer + platform config
/// @notice Deploys MerchantVault per borrowing agent, links registry + router
contract VaultFactory {
    struct PlatformConfig {
        address admin;
        address oracle;
        address usdc;
        uint16 defaultFeeBps;
        address feeRecipient;
        bool paused;
    }

    PlatformConfig public config;
    IAgentRegistry public registry;
    IPaymentRouter public router;

    address[] public allVaults;
    mapping(address => address) public agentToVault;

    event VaultCreated(
        address indexed agent,
        address indexed vault,
        uint256 targetAmount,
        uint256 interestRateBps,
        uint256 durationSeconds
    );
    event PlatformConfigUpdated();

    modifier onlyAdmin() {
        if (msg.sender != config.admin) revert Errors.Unauthorized();
        _;
    }

    modifier notPaused() {
        if (config.paused) revert Errors.PlatformPaused();
        _;
    }

    constructor(
        address _admin,
        address _oracle,
        address _usdc,
        uint16 _defaultFeeBps,
        address _feeRecipient,
        address _registry,
        address _router
    ) {
        if (_admin == address(0) || _usdc == address(0) || _registry == address(0) || _router == address(0))
            revert Errors.ZeroAddress();

        config = PlatformConfig({
            admin: _admin,
            oracle: _oracle,
            usdc: _usdc,
            defaultFeeBps: _defaultFeeBps,
            feeRecipient: _feeRecipient,
            paused: false
        });
        registry = IAgentRegistry(_registry);
        router = IPaymentRouter(_router);
    }

    // ─── Create Vault ────────────────────────────────────────────

    function createVault(
        address agent,
        uint256 targetAmount,
        uint256 interestRateBps,
        uint256 durationSeconds,
        uint256 numTranches,
        uint16 repaymentRateBps,
        uint64 minPaymentInterval,
        uint256 maxSinglePayment
    ) external onlyAdmin notPaused returns (address vault) {
        if (!registry.isRegistered(agent)) revert Errors.AgentNotRegistered();
        if (agentToVault[agent] != address(0)) revert Errors.VaultAlreadyExists();
        if (targetAmount == 0) revert Errors.InvalidAmount();

        // CREATE2 deploy with agent as salt
        bytes32 salt = keccak256(abi.encodePacked(agent, block.timestamp));

        vault = address(
            new MerchantVault{salt: salt}(
                config.usdc,
                agent,
                config.admin,
                address(this),
                targetAmount,
                interestRateBps,
                durationSeconds,
                numTranches,
                config.defaultFeeBps,
                config.feeRecipient
            )
        );

        allVaults.push(vault);
        agentToVault[agent] = vault;

        // Link vault in registry
        registry.linkVault(agent, vault);

        // Create settlement in router
        router.createSettlement(agent, vault, repaymentRateBps, minPaymentInterval, maxSinglePayment);

        emit VaultCreated(agent, vault, targetAmount, interestRateBps, durationSeconds);
    }

    // ─── Predicted Address ───────────────────────────────────────

    function predictVaultAddress(address agent) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(agent, block.timestamp));
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(
                    abi.encodePacked(
                        type(MerchantVault).creationCode,
                        abi.encode(
                            config.usdc,
                            agent,
                            config.admin,
                            address(this),
                            uint256(0), // placeholder
                            uint256(0),
                            uint256(0),
                            uint256(0),
                            config.defaultFeeBps,
                            config.feeRecipient
                        )
                    )
                )
            )
        );
        return address(uint160(uint256(hash)));
    }

    // ─── Admin ───────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyAdmin {
        config.oracle = _oracle;
        emit PlatformConfigUpdated();
    }

    function setPlatformFee(uint16 _feeBps) external onlyAdmin {
        if (_feeBps > 1000) revert Errors.FeeTooHigh(); // max 10%
        config.defaultFeeBps = _feeBps;
        emit PlatformConfigUpdated();
    }

    function setFeeRecipient(address _recipient) external onlyAdmin {
        if (_recipient == address(0)) revert Errors.ZeroAddress();
        config.feeRecipient = _recipient;
        emit PlatformConfigUpdated();
    }

    function pausePlatform() external onlyAdmin {
        config.paused = true;
    }

    function unpausePlatform() external onlyAdmin {
        config.paused = false;
    }

    // ─── View ────────────────────────────────────────────────────

    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }

    function getVaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    function getOracle() external view returns (address) {
        return config.oracle;
    }
}
