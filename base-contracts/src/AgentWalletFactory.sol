// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentWallet} from "./AgentWallet.sol";
import {Errors} from "./libraries/Errors.sol";

/// @title AgentWalletFactory — deploy deterministic AgentWallet instances
/// @notice One wallet per owner. Uses CREATE2 for predictable addresses.
contract AgentWalletFactory {
    address public immutable usdc;
    address public admin;

    mapping(address => address) public ownerToWallet;
    address[] public allWallets;

    event WalletCreated(address indexed owner, address indexed operator, address wallet);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Errors.Unauthorized();
        _;
    }

    constructor(address _usdc, address _admin) {
        if (_usdc == address(0) || _admin == address(0)) revert Errors.ZeroAddress();
        usdc = _usdc;
        admin = _admin;
    }

    /// @notice Create a new AgentWallet for the caller
    function createWallet(
        address operator,
        uint256 dailyLimit,
        uint256 perTxLimit
    ) external returns (address) {
        if (ownerToWallet[msg.sender] != address(0)) revert Errors.VaultAlreadyExists();

        bytes32 salt = keccak256(abi.encode(msg.sender));
        AgentWallet wallet = new AgentWallet{salt: salt}(
            usdc,
            msg.sender,
            operator,
            dailyLimit,
            perTxLimit
        );

        address walletAddr = address(wallet);
        ownerToWallet[msg.sender] = walletAddr;
        allWallets.push(walletAddr);

        emit WalletCreated(msg.sender, operator, walletAddr);
        return walletAddr;
    }

    /// @notice Predict wallet address for a given owner
    function predictWalletAddress(address owner) external view returns (address) {
        bytes32 salt = keccak256(abi.encode(owner));
        bytes memory bytecode = abi.encodePacked(
            type(AgentWallet).creationCode,
            abi.encode(usdc, owner, address(0), uint256(0), uint256(0))
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }

    function getAllWallets() external view returns (address[] memory) {
        return allWallets;
    }

    function totalWallets() external view returns (uint256) {
        return allWallets.length;
    }
}
