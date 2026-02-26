// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPaymentRouter} from "./interfaces/IPaymentRouter.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IMerchantVault} from "./interfaces/IMerchantVault.sol";
import {SignatureLib} from "./libraries/SignatureLib.sol";
import {Errors} from "./libraries/Errors.sol";

/// @title PaymentRouter — x402 payment execution + revenue splitting
/// @notice THE contract for the accelerator demo. Single executePayment() entry point.
contract PaymentRouter is IPaymentRouter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IAgentRegistry public immutable registry;
    address public admin;
    address public oracle;

    mapping(address => Settlement) private _settlements;
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Errors.Unauthorized();
        _;
    }

    modifier onlyAdminOrFactory() {
        if (msg.sender != admin && msg.sender != factory) revert Errors.Unauthorized();
        _;
    }

    address public factory;

    bool public paused;
    address public pendingAdmin;

    modifier notPaused() {
        if (paused) revert Errors.PlatformPaused();
        _;
    }

    constructor(address _usdc, address _registry, address _admin, address _oracle) {
        if (_usdc == address(0) || _registry == address(0) || _admin == address(0) || _oracle == address(0))
            revert Errors.ZeroAddress();

        usdc = IERC20(_usdc);
        registry = IAgentRegistry(_registry);
        admin = _admin;
        oracle = _oracle;
    }

    function setFactory(address _factory) external onlyAdmin {
        if (_factory == address(0)) revert Errors.ZeroAddress();
        address old = factory;
        factory = _factory;
        emit FactoryUpdated(old, _factory);
    }

    function setOracle(address _oracle) external onlyAdmin {
        if (_oracle == address(0)) revert Errors.ZeroAddress();
        address old = oracle;
        oracle = _oracle;
        emit OracleUpdated(old, _oracle);
    }

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function proposeAdmin(address _newAdmin) external onlyAdmin {
        if (_newAdmin == address(0)) revert Errors.ZeroAddress();
        pendingAdmin = _newAdmin;
        emit AdminTransferProposed(admin, _newAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert Errors.Unauthorized();
        address old = admin;
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit AdminTransferred(old, admin);
    }

    // ─── Execute Payment (THE x402 function) ─────────────────────

    function executePayment(X402Payment calldata payment, bytes calldata signature) external nonReentrant notPaused {
        // 1. Validate deadline
        if (block.timestamp > payment.deadline) revert Errors.PaymentExpired();

        // 2. Verify signature (oracle signs the payment proof) — ALWAYS required
        bytes32 paymentHash = SignatureLib.paymentHash(
            payment.from,
            payment.to,
            payment.amount,
            payment.nonce,
            payment.deadline,
            payment.paymentId
        );
        if (!SignatureLib.verifyPaymentProof(paymentHash, signature, oracle))
            revert Errors.InvalidSignature();

        // 3. Replay protection
        if (usedNonces[payment.from][payment.nonce]) revert Errors.NonceAlreadyUsed();
        usedNonces[payment.from][payment.nonce] = true;

        // 4. Amount validation
        if (payment.amount == 0) revert Errors.InvalidAmount();

        // 5. Check settlement for receiving agent
        Settlement storage settlement = _settlements[payment.to];
        uint256 repaymentAmount = 0;

        if (settlement.active) {
            // Rate limiting
            if (settlement.minPaymentInterval > 0) {
                if (block.timestamp < settlement.lastPaymentAt + settlement.minPaymentInterval)
                    revert Errors.RateLimitExceeded();
            }

            // Max payment cap
            if (settlement.maxSinglePayment > 0 && payment.amount > settlement.maxSinglePayment)
                revert Errors.PaymentTooLarge();

            // Calculate split
            repaymentAmount = (payment.amount * settlement.repaymentRateBps) / 10_000;
            uint256 netAmount = payment.amount - repaymentAmount;

            // Transfer from payer
            usdc.safeTransferFrom(payment.from, address(this), payment.amount);

            // Route repayment to vault
            if (repaymentAmount > 0) {
                usdc.forceApprove(settlement.vault, repaymentAmount);
                IMerchantVault(settlement.vault).processRepayment(repaymentAmount);
            }

            // Route net to receiving agent
            if (netAmount > 0) {
                usdc.safeTransfer(payment.to, netAmount);
            }

            // Update settlement stats
            settlement.totalRouted += repaymentAmount;
            settlement.totalPayments++;
            settlement.lastPaymentAt = block.timestamp;
        } else {
            // No active credit line — direct payment
            usdc.safeTransferFrom(payment.from, payment.to, payment.amount);
        }

        // 6. Update agent stats in registry
        try registry.incrementPaymentsSent(payment.from, payment.amount) {} catch {}
        try registry.incrementPaymentsReceived(payment.to, payment.amount) {} catch {}

        emit PaymentExecuted(
            payment.from,
            payment.to,
            payment.amount,
            repaymentAmount,
            payment.paymentId,
            payment.nonce
        );
    }

    // ─── Settlement Management ───────────────────────────────────

    function createSettlement(
        address agent,
        address vault,
        uint16 repaymentRateBps,
        uint64 minPaymentInterval,
        uint256 maxSinglePayment
    ) external onlyAdminOrFactory {
        if (agent == address(0) || vault == address(0)) revert Errors.ZeroAddress();
        if (repaymentRateBps > 5000) revert Errors.FeeTooHigh(); // max 50%

        _settlements[agent] = Settlement({
            vault: vault,
            repaymentRateBps: repaymentRateBps,
            totalRouted: 0,
            totalPayments: 0,
            lastPaymentAt: 0,
            minPaymentInterval: minPaymentInterval,
            maxSinglePayment: maxSinglePayment,
            active: true
        });

        emit SettlementCreated(agent, vault, repaymentRateBps);
    }

    function deactivateSettlement(address agent) external onlyAdmin {
        _settlements[agent].active = false;
        emit SettlementDeactivated(agent);
    }

    function updateSettlement(address agent, uint16 repaymentRateBps) external onlyAdmin {
        if (!_settlements[agent].active) revert Errors.SettlementNotActive();
        if (repaymentRateBps > 5000) revert Errors.FeeTooHigh();

        _settlements[agent].repaymentRateBps = repaymentRateBps;
        emit SettlementUpdated(agent, repaymentRateBps);
    }

    // ─── View ────────────────────────────────────────────────────

    function getSettlement(address agent) external view returns (Settlement memory) {
        return _settlements[agent];
    }

    function isNonceUsed(address agent, uint256 nonce) external view returns (bool) {
        return usedNonces[agent][nonce];
    }
}
