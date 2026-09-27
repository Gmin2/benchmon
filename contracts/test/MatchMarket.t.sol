// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CardStats} from "../src/CardStats.sol";
import {Duel} from "../src/Duel.sol";
import {MatchMarket} from "../src/MatchMarket.sol";

contract MatchMarketTest is Test {
    CardStats cards;
    Duel duel;
    MatchMarket market;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint16[5] deck = [uint16(0), 1, 2, 3, 4];
    uint256 constant B = 10 ether;

    function setUp() public {
        cards = new CardStats();
        cards.setCard(0, "strong", [uint8(90), 90, 90, 90, 90, 90]);
        cards.setCard(1, "weak", [uint8(10), 10, 10, 10, 10, 10]);
        cards.setCard(2, "mid", [uint8(50), 50, 50, 50, 50, 50]);
        cards.setCard(3, "weak2", [uint8(10), 10, 10, 10, 10, 10]);
        cards.setCard(4, "mid2", [uint8(50), 50, 50, 50, 50, 50]);
        duel = new Duel(cards, address(0));
        market = new MatchMarket(duel);
        vm.deal(address(this), 1000 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    receive() external payable {}

    function _start() internal returns (uint256 id) {
        vm.prank(alice);
        id = duel.create{value: 1 ether}(deck);
        vm.prank(bob);
        duel.join{value: 1 ether}(id, deck);
        market.open{value: market.maxLoss(B)}(id, B);
    }

    function _round(uint256 id, uint16 ca, uint16 cb) internal {
        uint8 round = duel.getMatch(id).round;
        vm.prank(alice);
        duel.commit(id, keccak256(abi.encode(id, round, alice, ca, bytes32("a"))));
        vm.prank(bob);
        duel.commit(id, keccak256(abi.encode(id, round, bob, cb, bytes32("b"))));
        vm.prank(alice);
        duel.reveal(id, ca, "a");
        vm.prank(bob);
        duel.reveal(id, cb, "b");
    }

    function _buy(address who, uint256 id, uint8 side, uint256 amount) internal {
        vm.deal(who, who.balance + 1000 ether);
        vm.prank(who);
        market.buy{value: 1000 ether}(id, side, amount);
    }

    function test_priceMovesAndWinnerRedeems() public {
        uint256 id = _start();
        assertApproxEqAbs(market.priceA(id), 0.5e18, 1);
        address x = makeAddr("x");
        _buy(x, id, 1, 5 ether);
        assertGt(market.priceA(id), 0.5e18);
        address y = makeAddr("y");
        _buy(y, id, 2, 2 ether);
        _round(id, 0, 1);
        _round(id, 2, 3); // a wins
        uint256 before = x.balance;
        vm.prank(x);
        market.redeem(id);
        assertEq(x.balance - before, 5 ether);
        vm.prank(y);
        vm.expectRevert(MatchMarket.TooLittle.selector);
        market.redeem(id);
        uint256 houseBefore = address(this).balance;
        market.houseSettle(id);
        assertGt(address(this).balance, houseBefore);
        assertEq(address(market).balance, 0);
    }

    function test_closedAfterFirstRevealAndSeedRules() public {
        vm.prank(alice);
        uint256 id = duel.create{value: 1 ether}(deck);
        vm.expectRevert(MatchMarket.TooLittle.selector);
        market.open{value: 1 ether}(id, B);
        vm.prank(alice);
        vm.expectRevert(MatchMarket.NotHouse.selector);
        market.open{value: 10 ether}(id, B);
        vm.prank(bob);
        duel.join{value: 1 ether}(id, deck);
        market.open{value: market.maxLoss(B)}(id, B);
        uint8 round = duel.getMatch(id).round;
        vm.prank(alice);
        duel.commit(id, keccak256(abi.encode(id, round, alice, uint16(0), bytes32("a"))));
        vm.prank(bob);
        duel.commit(id, keccak256(abi.encode(id, round, bob, uint16(1), bytes32("b"))));
        vm.prank(alice);
        duel.reveal(id, 0, "a");
        address late = makeAddr("late");
        vm.deal(late, 10 ether);
        vm.prank(late);
        vm.expectRevert(MatchMarket.Closed.selector);
        market.buy{value: 10 ether}(id, 1, 1 ether);
    }

    function test_sellBack() public {
        uint256 id = _start();
        address x = makeAddr("x");
        uint256 start = x.balance;
        _buy(x, id, 1, 3 ether);
        vm.prank(x);
        market.sell(id, 1, 3 ether);
        // buying then selling the same shares loses at most a couple of wei
        assertApproxEqAbs(x.balance, start + 1000 ether, 2);
        assertApproxEqAbs(market.priceA(id), 0.5e18, 1);
    }

    // random trades by several traders, then any result: the market can always pay every share and the house
    // never loses more than b * ln 2
    function testFuzz_solventForEveryOutcome(uint64[8] memory amounts, uint8 sides, uint8 sells, uint8 result) public {
        uint256 id = _start();
        address[8] memory who;
        for (uint256 i; i < 8; i++) {
            who[i] = address(uint160(0x2000 + i));
            uint256 amt = bound(amounts[i], 1e12, 50 ether);
            uint8 side = ((sides >> i) & 1) == 0 ? 1 : 2;
            _buy(who[i], id, side, amt);
            if ((sells >> i) & 1 == 1) {
                vm.prank(who[i]);
                market.sell(id, side, amt / 2 + 1e12 > amt ? amt : amt / 2 + 1e12);
            }
        }
        (, uint256 qA, uint256 qB, uint256 collateral,,) = market.markets(id);
        assertGe(collateral, qA, "cannot pay a");
        assertGe(collateral, qB, "cannot pay b");
        assertGe(collateral, (qA + qB) / 2, "cannot pay a draw");

        result = uint8(bound(result, 0, 2));
        if (result == 0) {
            _round(id, 2, 4);
            _round(id, 4, 2);
            _round(id, 0, 0);
        } else if (result == 1) {
            _round(id, 0, 1);
            _round(id, 2, 3);
        } else {
            _round(id, 1, 0);
            _round(id, 3, 2);
        }
        for (uint256 i; i < 8; i++) {
            if (market.redeemable(id, who[i]) > 0) {
                vm.prank(who[i]);
                market.redeem(id);
            }
        }
        // houseSettle reverts if the collateral cannot cover what the shares claim
        market.houseSettle(id);
        assertLe(address(market).balance, 8, "dust above a few wei");
    }
}
