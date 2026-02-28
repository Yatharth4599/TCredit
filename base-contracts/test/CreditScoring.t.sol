// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {VaultFactory} from "../src/VaultFactory.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {Errors} from "../src/libraries/Errors.sol";

contract CreditScoringTest is Test {
    MockUSDC public usdc;
    AgentRegistry public registry;
    PaymentRouter public router;
    VaultFactory public factory;

    address oracle = vm.addr(0xB0B);
    address admin = makeAddr("admin");
    address agent = makeAddr("translateBot");
    address agent2 = makeAddr("shopBot");
    address feeRecipient = makeAddr("feeRecipient");

    function setUp() public {
        usdc = new MockUSDC();
        registry = new AgentRegistry(admin);
        router = new PaymentRouter(address(usdc), address(registry), admin, oracle);

        vm.startPrank(admin);
        registry.setPaymentRouter(address(router));
        factory = new VaultFactory(
            admin, oracle, address(usdc), 200, feeRecipient,
            address(registry), address(router)
        );
        registry.setFactory(address(factory));
        router.setFactory(address(factory));
        vm.stopPrank();

        vm.prank(agent);
        registry.registerAgent("ipfs://translateBot");

        vm.prank(agent2);
        registry.registerAgent("ipfs://shopBot");
    }

    // ════════════════════════════════════════════════════════════════
    // Tier Derivation
    // ════════════════════════════════════════════════════════════════

    function test_updateCreditScore_tierA() public {
        vm.prank(admin);
        registry.updateCreditScore(agent, 750);

        IAgentRegistry.CreditProfile memory cp = registry.getCreditProfile(agent);
        assertEq(cp.score, 750);
        assertEq(uint8(cp.tier), uint8(IAgentRegistry.CreditTier.A));
        assertTrue(cp.updatedAt > 0);
    }

    function test_updateCreditScore_tierB() public {
        vm.prank(admin);
        registry.updateCreditScore(agent, 600);

        IAgentRegistry.CreditProfile memory cp = registry.getCreditProfile(agent);
        assertEq(cp.score, 600);
        assertEq(uint8(cp.tier), uint8(IAgentRegistry.CreditTier.B));
    }

    function test_updateCreditScore_tierC() public {
        vm.prank(admin);
        registry.updateCreditScore(agent, 450);

        IAgentRegistry.CreditProfile memory cp = registry.getCreditProfile(agent);
        assertEq(cp.score, 450);
        assertEq(uint8(cp.tier), uint8(IAgentRegistry.CreditTier.C));
    }

    function test_updateCreditScore_tierD() public {
        vm.prank(admin);
        registry.updateCreditScore(agent, 449);

        IAgentRegistry.CreditProfile memory cp = registry.getCreditProfile(agent);
        assertEq(cp.score, 449);
        assertEq(uint8(cp.tier), uint8(IAgentRegistry.CreditTier.D));
    }

    // ════════════════════════════════════════════════════════════════
    // Access Control & Validation
    // ════════════════════════════════════════════════════════════════

    function test_updateCreditScore_onlyAdmin() public {
        vm.prank(agent);
        vm.expectRevert(Errors.Unauthorized.selector);
        registry.updateCreditScore(agent, 750);
    }

    function test_updateCreditScore_above1000_reverts() public {
        vm.prank(admin);
        vm.expectRevert(Errors.CreditScoreOutOfRange.selector);
        registry.updateCreditScore(agent, 1001);
    }

    function test_updateCreditScore_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit IAgentRegistry.CreditScoreUpdated(agent, 800, IAgentRegistry.CreditTier.A);

        vm.prank(admin);
        registry.updateCreditScore(agent, 800);
    }

    // ════════════════════════════════════════════════════════════════
    // Vault Creation Gating
    // ════════════════════════════════════════════════════════════════

    function test_tierD_blockedFromVaultCreation() public {
        vm.prank(admin);
        registry.updateCreditScore(agent, 300); // tier D

        vm.prank(admin);
        vm.expectRevert(Errors.CreditTierTooLow.selector);
        factory.createVault(agent, 50_000e6, 1200, 180 days, 4, 1500, 0, 0, 0, 0, type(uint256).max);
    }

    function test_expiredScore_blockedFromVaultCreation() public {
        vm.prank(admin);
        registry.updateCreditScore(agent, 750); // tier A, valid now

        // Warp past 90-day expiry
        vm.warp(block.timestamp + 90 days + 1);

        vm.prank(admin);
        vm.expectRevert(Errors.CreditScoreExpired.selector);
        factory.createVault(agent, 50_000e6, 1200, 180 days, 4, 1500, 0, 0, 0, 0, type(uint256).max);
    }

    function test_noScore_blockedFromVaultCreation() public {
        // agent2 has no credit score at all
        vm.prank(admin);
        vm.expectRevert(Errors.CreditScoreExpired.selector);
        factory.createVault(agent2, 50_000e6, 1200, 180 days, 4, 1500, 0, 0, 0, 0, type(uint256).max);
    }
}
