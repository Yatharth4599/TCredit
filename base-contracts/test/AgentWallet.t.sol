// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentWallet} from "../src/AgentWallet.sol";
import {AgentWalletFactory} from "../src/AgentWalletFactory.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {Errors} from "../src/libraries/Errors.sol";

contract AgentWalletTest is Test {
    MockUSDC public usdc;
    AgentWalletFactory public factory;

    address human = makeAddr("human");
    address agent = makeAddr("agent");
    address recipient = makeAddr("recipient");

    uint256 dailyLimit = 1000e6;  // $1000
    uint256 perTxLimit = 200e6;   // $200

    AgentWallet public wallet;

    function setUp() public {
        usdc = new MockUSDC();
        factory = new AgentWalletFactory(address(usdc), makeAddr("admin"));

        // Create wallet as human
        vm.prank(human);
        address walletAddr = factory.createWallet(agent, dailyLimit, perTxLimit);
        wallet = AgentWallet(walletAddr);

        // Fund wallet
        usdc.mint(walletAddr, 10_000e6);
    }

    // ─── Factory Tests ───────────────────────────────────────────

    function test_createWallet() public view {
        assertEq(wallet.owner(), human);
        assertEq(wallet.operator(), agent);
        assertEq(wallet.dailyLimit(), dailyLimit);
        assertEq(wallet.perTxLimit(), perTxLimit);
        assertEq(factory.ownerToWallet(human), address(wallet));
        assertEq(factory.totalWallets(), 1);
    }

    function test_createWallet_revertDuplicate() public {
        vm.prank(human);
        vm.expectRevert(Errors.VaultAlreadyExists.selector);
        factory.createWallet(agent, dailyLimit, perTxLimit);
    }

    // ─── Transfer Tests ──────────────────────────────────────────

    function test_transfer_success() public {
        vm.prank(agent);
        wallet.transfer(recipient, 100e6);
        assertEq(usdc.balanceOf(recipient), 100e6);
        assertEq(wallet.spentToday(), 100e6);
    }

    function test_transfer_perTxLimit() public {
        vm.prank(agent);
        vm.expectRevert(Errors.PaymentTooLarge.selector);
        wallet.transfer(recipient, 300e6); // exceeds 200 limit
    }

    function test_transfer_dailyLimit() public {
        // Spend 5 x $200 = $1000
        vm.startPrank(agent);
        wallet.transfer(recipient, 200e6);
        wallet.transfer(recipient, 200e6);
        wallet.transfer(recipient, 200e6);
        wallet.transfer(recipient, 200e6);
        wallet.transfer(recipient, 200e6);

        // Next should fail (daily limit $1000)
        vm.expectRevert(Errors.PaymentTooLarge.selector);
        wallet.transfer(recipient, 100e6);
        vm.stopPrank();
    }

    function test_transfer_dailyReset() public {
        vm.prank(agent);
        wallet.transfer(recipient, 200e6);
        assertEq(wallet.spentToday(), 200e6);

        // Advance 1 day
        vm.warp(block.timestamp + 1 days);

        vm.prank(agent);
        wallet.transfer(recipient, 200e6);
        assertEq(wallet.spentToday(), 200e6); // reset + new spend
    }

    function test_transfer_onlyOperator() public {
        vm.prank(human);
        vm.expectRevert(Errors.Unauthorized.selector);
        wallet.transfer(recipient, 100e6);
    }

    function test_transfer_frozen() public {
        vm.prank(human);
        wallet.freeze();

        vm.prank(agent);
        vm.expectRevert(Errors.VaultPaused.selector);
        wallet.transfer(recipient, 100e6);
    }

    // ─── Whitelist Tests ─────────────────────────────────────────

    function test_whitelist() public {
        vm.startPrank(human);
        wallet.toggleWhitelist(true);
        wallet.setWhitelist(recipient, true);
        vm.stopPrank();

        vm.prank(agent);
        wallet.transfer(recipient, 100e6); // allowed
        assertEq(usdc.balanceOf(recipient), 100e6);
    }

    function test_whitelist_blocked() public {
        vm.prank(human);
        wallet.toggleWhitelist(true);
        // recipient not whitelisted

        vm.prank(agent);
        vm.expectRevert(Errors.Unauthorized.selector);
        wallet.transfer(recipient, 100e6);
    }

    // ─── Owner Functions ─────────────────────────────────────────

    function test_setOperator() public {
        address newAgent = makeAddr("newAgent");
        vm.prank(human);
        wallet.setOperator(newAgent);
        assertEq(wallet.operator(), newAgent);
    }

    function test_setLimits() public {
        vm.prank(human);
        wallet.setLimits(5000e6, 500e6);
        assertEq(wallet.dailyLimit(), 5000e6);
        assertEq(wallet.perTxLimit(), 500e6);
    }

    function test_freeze_unfreeze() public {
        vm.prank(human);
        wallet.freeze();
        assertTrue(wallet.frozen());

        vm.prank(human);
        wallet.unfreeze();
        assertFalse(wallet.frozen());
    }

    function test_emergencyWithdraw() public {
        vm.prank(human);
        wallet.emergencyWithdraw(human);
        assertEq(usdc.balanceOf(human), 10_000e6);
        assertEq(usdc.balanceOf(address(wallet)), 0);
    }

    function test_emergencyWithdraw_onlyOwner() public {
        vm.prank(agent);
        vm.expectRevert(Errors.Unauthorized.selector);
        wallet.emergencyWithdraw(agent);
    }

    function test_linkCreditVault() public {
        address vault = makeAddr("vault");
        vm.prank(human);
        wallet.linkCreditVault(vault);
        assertEq(wallet.creditVault(), vault);
    }

    function test_getRemainingDaily() public {
        uint256 remaining = wallet.getRemainingDaily();
        assertEq(remaining, dailyLimit);

        vm.prank(agent);
        wallet.transfer(recipient, 100e6);

        remaining = wallet.getRemainingDaily();
        assertEq(remaining, dailyLimit - 100e6);
    }
}
