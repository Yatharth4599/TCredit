// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPaymentRouter {
    struct X402Payment {
        address from;
        address to;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
        bytes32 paymentId;
    }

    struct Settlement {
        address vault;
        uint16 repaymentRateBps;
        uint256 totalRouted;
        uint256 totalPayments;
        uint256 lastPaymentAt;
        uint64 minPaymentInterval;
        uint256 maxSinglePayment;
        bool active;
    }

    event PaymentExecuted(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 repaymentAmount,
        bytes32 indexed paymentId,
        uint256 nonce
    );
    event SettlementCreated(address indexed agent, address indexed vault, uint16 repaymentRateBps);
    event SettlementDeactivated(address indexed agent);
    event SettlementUpdated(address indexed agent, uint16 repaymentRateBps);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);
    event AdminTransferProposed(address indexed current, address indexed proposed);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    function executePayment(X402Payment calldata payment, bytes calldata signature) external;
    function createSettlement(
        address agent,
        address vault,
        uint16 repaymentRateBps,
        uint64 minPaymentInterval,
        uint256 maxSinglePayment
    ) external;
    function deactivateSettlement(address agent) external;
    function updateSettlement(address agent, uint16 repaymentRateBps) external;
    function setFactory(address _factory) external;
    function setOracle(address _oracle) external;
    function pause() external;
    function unpause() external;
    function proposeAdmin(address _newAdmin) external;
    function acceptAdmin() external;
    function getSettlement(address agent) external view returns (Settlement memory);
    function isNonceUsed(address agent, uint256 nonce) external view returns (bool);
}
