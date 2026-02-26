// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {Errors} from "../src/libraries/Errors.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    address admin = makeAddr("admin");
    address agent1 = makeAddr("agent1");
    address agent2 = makeAddr("agent2");

    function setUp() public {
        registry = new AgentRegistry(admin);
    }

    function test_registerAgent() public {
        vm.prank(agent1);
        registry.registerAgent("ipfs://QmAgent1");

        assertTrue(registry.isRegistered(agent1));
        assertEq(registry.getAgent(agent1).metadataURI, "ipfs://QmAgent1");
        assertEq(registry.getAgentCount(), 1);
    }

    function test_registerAgent_duplicate_reverts() public {
        vm.prank(agent1);
        registry.registerAgent("ipfs://QmAgent1");

        vm.prank(agent1);
        vm.expectRevert(Errors.AgentAlreadyRegistered.selector);
        registry.registerAgent("ipfs://QmAgent1v2");
    }

    function test_registerAgent_emptyMetadata_reverts() public {
        vm.prank(agent1);
        vm.expectRevert(Errors.InvalidMetadata.selector);
        registry.registerAgent("");
    }

    function test_updateMetadata() public {
        vm.prank(agent1);
        registry.registerAgent("ipfs://v1");

        vm.prank(agent1);
        registry.updateMetadata("ipfs://v2");

        assertEq(registry.getAgent(agent1).metadataURI, "ipfs://v2");
    }

    function test_linkVault_onlyAuthorized() public {
        vm.prank(agent1);
        registry.registerAgent("ipfs://QmAgent1");

        address vault = makeAddr("vault");

        // Unauthorized
        vm.prank(agent2);
        vm.expectRevert(Errors.Unauthorized.selector);
        registry.linkVault(agent1, vault);

        // Admin can link
        vm.prank(admin);
        registry.linkVault(agent1, vault);
        assertTrue(registry.hasActiveCreditLine(agent1));
        assertEq(registry.getVault(agent1), vault);
    }

    function test_deactivateAgent() public {
        vm.prank(agent1);
        registry.registerAgent("ipfs://QmAgent1");

        vm.prank(admin);
        registry.deactivateAgent(agent1);

        assertFalse(registry.getAgent(agent1).active);
    }

    function test_setFactory_onlyAdmin() public {
        address factory = makeAddr("factory");

        vm.prank(agent1);
        vm.expectRevert(Errors.Unauthorized.selector);
        registry.setFactory(factory);

        vm.prank(admin);
        registry.setFactory(factory);
        assertEq(registry.factory(), factory);
    }
}
