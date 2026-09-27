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
}
