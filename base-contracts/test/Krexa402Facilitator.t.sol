// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Krexa402Facilitator} from "../src/Krexa402Facilitator.sol";
import {IKrexa402Facilitator} from "../src/interfaces/IKrexa402Facilitator.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {IPaymentRouter} from "../src/interfaces/IPaymentRouter.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {Errors} from "../src/libraries/Errors.sol";

contract Krexa402FacilitatorTest is Test {
    MockUSDC public usdc;
    AgentRegistry public registry;
    PaymentRouter public router;
    Krexa402Facilitator public facilitator;

    uint256 oraclePrivKey = 0xA11CE;
    address oracle = vm.addr(oraclePrivKey);
    address admin = makeAddr("admin");
    address merchant = makeAddr("merchant");
    address payer = makeAddr("payer");

    uint16 facilitatorFeeBps = 250; // 2.5%

    function setUp() public {
        usdc = new MockUSDC();
        registry = new AgentRegistry(admin);
        router = new PaymentRouter(address(usdc), address(registry), admin, oracle);
        facilitator = new Krexa402Facilitator(
            address(usdc), address(router), admin, facilitatorFeeBps
        );

        vm.prank(admin);
        registry.setPaymentRouter(address(router));

        // Register agents
        vm.prank(merchant);
        registry.registerAgent("ipfs://merchant");
        vm.prank(payer);
        registry.registerAgent("ipfs://payer");

        // Fund payer
        usdc.mint(payer, 100_000e6);
    }

    function test_registerResource() public {
        bytes32 hash = keccak256("https://api.example.com/translate");
        vm.prank(merchant);
        facilitator.registerResource(hash, 5e6); // $5 per call

        IKrexa402Facilitator.Resource memory res = facilitator.getResource(hash);
        assertEq(res.owner, merchant);
        assertEq(res.pricePerCall, 5e6);
        assertTrue(res.active);
    }

    function test_registerResource_revertDuplicate() public {
        bytes32 hash = keccak256("https://api.example.com/translate");
        vm.prank(merchant);
        facilitator.registerResource(hash, 5e6);

        vm.prank(merchant);
        vm.expectRevert(Errors.VaultAlreadyExists.selector);
        facilitator.registerResource(hash, 10e6);
    }

    function test_updateResourcePrice() public {
        bytes32 hash = keccak256("https://api.example.com/translate");
        vm.prank(merchant);
        facilitator.registerResource(hash, 5e6);

        vm.prank(merchant);
        facilitator.updateResourcePrice(hash, 10e6);

        IKrexa402Facilitator.Resource memory res = facilitator.getResource(hash);
        assertEq(res.pricePerCall, 10e6);
    }

    function test_updateResourcePrice_onlyOwner() public {
        bytes32 hash = keccak256("https://api.example.com/translate");
        vm.prank(merchant);
        facilitator.registerResource(hash, 5e6);

        vm.prank(payer);
        vm.expectRevert(Errors.Unauthorized.selector);
        facilitator.updateResourcePrice(hash, 10e6);
    }

    function test_deactivateResource() public {
        bytes32 hash = keccak256("https://api.example.com/translate");
        vm.prank(merchant);
        facilitator.registerResource(hash, 5e6);

        vm.prank(merchant);
        facilitator.deactivateResource(hash);

        IKrexa402Facilitator.Resource memory res = facilitator.getResource(hash);
        assertFalse(res.active);
    }

    function test_setFacilitatorFeeBps() public {
        vm.prank(admin);
        facilitator.setFacilitatorFeeBps(500);
        assertEq(facilitator.facilitatorFeeBps(), 500);
    }

    function test_setFacilitatorFeeBps_revertTooHigh() public {
        vm.prank(admin);
        vm.expectRevert(Errors.FeeTooHigh.selector);
        facilitator.setFacilitatorFeeBps(1001);
    }

    function test_setFacilitatorFeeBps_onlyAdmin() public {
        vm.prank(payer);
        vm.expectRevert(Errors.Unauthorized.selector);
        facilitator.setFacilitatorFeeBps(500);
    }
}
