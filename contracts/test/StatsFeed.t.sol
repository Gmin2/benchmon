// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICardStats} from "../src/interfaces/ICardStats.sol";
import {IStatsFeed} from "../src/interfaces/IStatsFeed.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {Test} from "forge-std/Test.sol";
import {CardStats} from "../src/CardStats.sol";
import {StatsFeed} from "../src/StatsFeed.sol";
import {IReceiver, IERC165} from "../src/interfaces/IReceiver.sol";

contract StatsFeedTest is Test {
    CardStats cards;
    StatsFeed feed;
    address forwarder = makeAddr("forwarder");

    function setUp() public {
        cards = new CardStats();
        cards.setCard(0, "claude", [uint8(90), 88, 95, 40, 20, 90]);
        feed = new StatsFeed(cards, forwarder);
        cards.setUpdater(address(feed));
    }

    function _report(uint256 id, uint8 v) internal pure returns (bytes memory) {
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        uint8[6][] memory s = new uint8[6][](1);
        s[0] = [v, v, v, v, v, v];
        return abi.encode(ids, s);
    }

    function test_forwarderUpdatesStatsAndKeepsName() public {
        vm.prank(forwarder);
        feed.onReport("", _report(0, 77));
        assertEq(cards.statsOf(0)[3], 77);
        assertEq(cards.names(0), "claude");
        assertEq(feed.reports(), 1);
    }

    function test_onlyForwarder() public {
        vm.expectRevert(IStatsFeed.NotForwarder.selector);
        feed.onReport("", _report(0, 77));
        vm.prank(makeAddr("x"));
        vm.expectRevert(Ownable.Unauthorized.selector);
        feed.setForwarder(makeAddr("x"));
    }

    function test_badReports() public {
        vm.prank(forwarder);
        vm.expectRevert(ICardStats.BadStat.selector);
        feed.onReport("", _report(0, 0));
        uint256[] memory ids = new uint256[](2);
        uint8[6][] memory s = new uint8[6][](1);
        s[0] = [uint8(1), 1, 1, 1, 1, 1];
        vm.prank(forwarder);
        vm.expectRevert(IStatsFeed.BadReport.selector);
        feed.onReport("", abi.encode(ids, s));
    }

    function test_erc165() public view {
        assertTrue(feed.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(feed.supportsInterface(type(IERC165).interfaceId));
        assertFalse(feed.supportsInterface(0xdeadbeef));
    }

    function test_ownerMovesToTheProductionForwarder() public {
        address prod = makeAddr("prod");
        feed.setForwarder(prod);
        vm.prank(forwarder);
        vm.expectRevert(IStatsFeed.NotForwarder.selector);
        feed.onReport("", _report(0, 60));
        vm.prank(prod);
        feed.onReport("", _report(0, 60));
        assertEq(cards.statsOf(0)[0], 60);
    }

    function _meta(bytes32 id, address wfOwner) internal pure returns (bytes memory) {
        return abi.encodePacked(id, bytes10("stats"), wfOwner, bytes2(0));
    }

    function test_onlyTheExpectedWorkflow() public {
        address me = makeAddr("workflow owner");
        bytes32 wid = keccak256("model cards stats");
        feed.setWorkflow(me, wid);
        vm.startPrank(forwarder);
        // someone else's workflow, delivered by the same forwarder
        vm.expectRevert(IStatsFeed.WrongWorkflow.selector);
        feed.onReport(_meta(wid, makeAddr("attacker")), _report(0, 11));
        vm.expectRevert(IStatsFeed.WrongWorkflow.selector);
        feed.onReport(_meta(keccak256("other"), me), _report(0, 11));
        vm.expectRevert(IStatsFeed.WrongWorkflow.selector);
        feed.onReport("", _report(0, 11));
        // ours, with the 64 byte production metadata
        feed.onReport(_meta(wid, me), _report(0, 55));
        vm.stopPrank();
        assertEq(cards.statsOf(0)[0], 55);
    }

    function testFuzz_ownerCheckFromMetadata(address wfOwner, address other, bytes32 wid) public {
        vm.assume(wfOwner != address(0) && other != wfOwner);
        feed.setWorkflow(wfOwner, bytes32(0));
        vm.startPrank(forwarder);
        vm.expectRevert(IStatsFeed.WrongWorkflow.selector);
        feed.onReport(_meta(wid, other), _report(0, 20));
        feed.onReport(_meta(wid, wfOwner), _report(0, 21));
        vm.stopPrank();
        assertEq(cards.statsOf(0)[0], 21);
    }
}
