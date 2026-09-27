// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CardStats} from "../src/CardStats.sol";
import {Duel} from "../src/Duel.sol";
import {Backing} from "../src/Backing.sol";

contract BackingTest is Test {
    CardStats cards;
    Duel duel;
    Backing backing;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint16[5] deck = [uint16(0), 1, 2, 3, 4];

    function setUp() public {
        cards = new CardStats();
        cards.setCard(0, "strong", [uint8(90), 90, 90, 90, 90, 90]);
        cards.setCard(1, "weak", [uint8(10), 10, 10, 10, 10, 10]);
        cards.setCard(2, "mid", [uint8(50), 50, 50, 50, 50, 50]);
        cards.setCard(3, "weak2", [uint8(10), 10, 10, 10, 10, 10]);
        cards.setCard(4, "mid2", [uint8(50), 50, 50, 50, 50, 50]);
        duel = new Duel(cards, address(0));
        backing = new Backing(duel);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _start() internal returns (uint256 id) {
        vm.prank(alice);
        id = duel.create{value: 1 ether}(deck);
        vm.prank(bob);
        duel.join{value: 1 ether}(id, deck);
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

    function _back(address who, uint256 id, uint8 side, uint256 amount) internal {
        vm.deal(who, who.balance + amount);
        vm.prank(who);
        backing.back{value: amount}(id, side);
    }

    function test_winnersSplitThePool() public {
        uint256 id = _start();
        address x = makeAddr("x");
        address y = makeAddr("y");
        address z = makeAddr("z");
        _back(x, id, 1, 3 ether);
        _back(y, id, 1, 1 ether);
        _back(z, id, 2, 4 ether);
        _round(id, 0, 1); // a
        _round(id, 2, 3); // a, match over
        vm.prank(x);
        backing.claim(id);
        vm.prank(y);
        backing.claim(id);
        assertEq(x.balance, 6 ether);
        assertEq(y.balance, 2 ether);
        vm.prank(z);
        vm.expectRevert(Backing.NothingToClaim.selector);
        backing.claim(id);
        assertEq(address(backing).balance, 0);
    }

    function test_closesAtFirstReveal() public {
        uint256 id = _start();
        _back(makeAddr("x"), id, 1, 1 ether);
        uint8 round = duel.getMatch(id).round;
        vm.prank(alice);
        duel.commit(id, keccak256(abi.encode(id, round, alice, uint16(0), bytes32("a"))));
        vm.prank(bob);
        duel.commit(id, keccak256(abi.encode(id, round, bob, uint16(1), bytes32("b"))));
        vm.prank(alice);
        duel.reveal(id, 0, "a");
        address late = makeAddr("late");
        vm.deal(late, 1 ether);
        vm.prank(late);
        vm.expectRevert(Backing.Closed.selector);
        backing.back{value: 1 ether}(id, 1);
    }

    function test_drawAndCancelRefund() public {
        // cancelled before anyone joined
        vm.prank(alice);
        uint256 id = duel.create{value: 1 ether}(deck);
        address x = makeAddr("x");
        _back(x, id, 2, 2 ether);
        vm.prank(alice);
        duel.cancel(id);
        vm.prank(x);
        backing.claim(id);
        assertEq(x.balance, 2 ether);
    }

    function test_nobodyOnTheWinningSideRefunds() public {
        uint256 id = _start();
        address z = makeAddr("z");
        _back(z, id, 2, 1 ether);
        _round(id, 0, 1);
        _round(id, 2, 3); // a wins, nobody backed a
        vm.prank(z);
        backing.claim(id);
        assertEq(z.balance, 1 ether);
    }

    function test_cannotClaimBeforeTheEnd() public {
        uint256 id = _start();
        address x = makeAddr("x");
        _back(x, id, 1, 1 ether);
        vm.prank(x);
        vm.expectRevert(Backing.NotFinished.selector);
        backing.claim(id);
        vm.prank(x);
        vm.expectRevert(Backing.BadSide.selector);
        backing.back{value: 0}(id, 3);
    }

    // random backers and a random result: never pays out more than the pool, dust stays below one wei per backer,
    // winners never get less than they put in, losers get nothing
    function testFuzz_poolIsSolventAndFair(uint96[6] memory amounts, uint8 sides, uint8 result) public {
        uint256 id = _start();
        address[6] memory who;
        uint256 pool;
        for (uint256 i; i < 6; i++) {
            who[i] = address(uint160(0x1000 + i));
            uint256 amt = bound(amounts[i], 1, 1000 ether);
            _back(who[i], id, ((sides >> i) & 1) == 0 ? 1 : 2, amt);
            pool += amt;
        }
        result = uint8(bound(result, 0, 2));
        if (result == 0) {
            _round(id, 2, 4);
            _round(id, 4, 2);
            _round(id, 0, 0); // three draws
        } else if (result == 1) {
            _round(id, 0, 1);
            _round(id, 2, 3);
        } else {
            _round(id, 1, 0);
            _round(id, 3, 2);
        }
        uint8 r = duel.resultOf(id);
        uint256 paid;
        for (uint256 i; i < 6; i++) {
            uint256 before = who[i].balance;
            uint256 owed = backing.claimable(id, who[i]);
            if (owed > 0) {
                vm.prank(who[i]);
                backing.claim(id);
            }
            uint256 got = who[i].balance - before;
            paid += got;
            uint8 side = ((sides >> i) & 1) == 0 ? 1 : 2;
            bool winnerBacked = r != 3 && backing.totals(id, r) != 0;
            if (winnerBacked && side != r) assertEq(got, 0, "a loser got paid");
            if (winnerBacked && side == r) {
                assertGe(got, bound(amounts[i], 1, 1000 ether), "a winner got less than they put in");
            }
            if (!winnerBacked) assertEq(got, bound(amounts[i], 1, 1000 ether), "refund was not exact");
        }
        assertLe(paid, pool);
        assertLt(pool - paid, 6);
        assertEq(address(backing).balance, pool - paid);
    }
}
