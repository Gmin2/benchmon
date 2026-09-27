// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDuel} from "../src/interfaces/IDuel.sol";
import {ICardStats} from "../src/interfaces/ICardStats.sol";
import {Test} from "forge-std/Test.sol";
import {CardStats} from "../src/CardStats.sol";
import {Duel} from "../src/Duel.sol";

contract DuelTest is Test {
    CardStats cards;
    Duel duel;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint16[5] deck = [uint16(0), 1, 2, 3, 4];

    function setUp() public {
        cards = new CardStats();
        // card 0 wins every stat, card 1 loses every stat, card 2 sits in the middle
        cards.setCard(0, "strong", [uint8(90), 90, 90, 90, 90, 90]);
        cards.setCard(1, "weak", [uint8(10), 10, 10, 10, 10, 10]);
        cards.setCard(2, "mid", [uint8(50), 50, 50, 50, 50, 50]);
        cards.setCard(3, "mid2", [uint8(50), 50, 50, 50, 50, 50]);
        cards.setCard(4, "weak2", [uint8(10), 10, 10, 10, 10, 10]);
        duel = new Duel(cards, address(0));
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _commit(address p, uint256 id, uint16 card, bytes32 salt) internal {
        uint8 round = duel.getMatch(id).round;
        vm.prank(p);
        duel.commit(id, keccak256(abi.encode(id, round, p, card, salt)));
    }

    function _play(uint256 id, uint16 ca, uint16 cb) internal {
        _commit(alice, id, ca, "sa");
        _commit(bob, id, cb, "sb");
        vm.prank(alice);
        duel.reveal(id, ca, "sa");
        vm.prank(bob);
        duel.reveal(id, cb, "sb");
    }

    function _cash() internal {
        if (duel.owed(alice) > 0) {
            vm.prank(alice);
            duel.withdraw();
        }
        if (duel.owed(bob) > 0) {
            vm.prank(bob);
            duel.withdraw();
        }
    }

    function _start() internal returns (uint256 id) {
        vm.prank(alice);
        id = duel.create{value: 1 ether}(deck);
        vm.prank(bob);
        duel.join{value: 1 ether}(id, deck);
    }

    function test_winnerTakesPot() public {
        uint256 id = _start();
        _play(id, 0, 1);
        _play(id, 2, 3); // draw round
        _play(id, 1, 0);
        // 1 win each after three rounds: draw, both refunded
        _cash();
        assertEq(alice.balance, 10 ether);
        assertEq(bob.balance, 10 ether);
    }

    function test_twoWinsEndsEarly() public {
        uint256 id = _start();
        _play(id, 0, 1);
        _play(id, 2, 4);
        _cash();
        assertEq(alice.balance, 11 ether);
        assertEq(bob.balance, 9 ether);
        assertEq(uint8(duel.getMatch(id).state), uint8(IDuel.State.Done));
    }

    function test_badRevealReverts() public {
        uint256 id = _start();
        _commit(alice, id, 0, "sa");
        _commit(bob, id, 1, "sb");
        vm.prank(alice);
        vm.expectRevert(IDuel.BadReveal.selector);
        duel.reveal(id, 1, "sa");
    }

    function test_cardCannotBeReused() public {
        uint256 id = _start();
        _play(id, 2, 3);
        _commit(alice, id, 2, "x");
        _commit(bob, id, 1, "y");
        vm.prank(alice);
        vm.expectRevert(IDuel.CardUsed.selector);
        duel.reveal(id, 2, "x");
    }

    function test_timeoutPaysThePlayerWhoMoved() public {
        uint256 id = _start();
        _commit(alice, id, 0, "sa");
        vm.expectRevert(IDuel.TooEarly.selector);
        duel.claimTimeout(id);
        vm.warp(block.timestamp + 61);
        duel.claimTimeout(id);
        _cash();
        assertEq(alice.balance, 11 ether);
        assertEq(bob.balance, 9 ether);
    }

    function test_revealTimeout() public {
        uint256 id = _start();
        _commit(alice, id, 0, "sa");
        _commit(bob, id, 1, "sb");
        vm.prank(bob);
        duel.reveal(id, 1, "sb");
        vm.warp(block.timestamp + 61);
        duel.claimTimeout(id);
        _cash();
        assertEq(bob.balance, 11 ether);
    }

    function test_wrongStakeAndStranger() public {
        vm.prank(alice);
        uint256 id = duel.create{value: 1 ether}(deck);
        vm.prank(bob);
        vm.expectRevert(IDuel.WrongStake.selector);
        duel.join{value: 0.5 ether}(id, deck);
        vm.prank(bob);
        duel.join{value: 1 ether}(id, deck);
        vm.prank(makeAddr("eve"));
        vm.expectRevert(IDuel.NotPlayer.selector);
        duel.commit(id, bytes32(uint256(1)));
    }

    function test_cancelBeforeJoin() public {
        vm.prank(alice);
        uint256 id = duel.create{value: 1 ether}(deck);
        vm.prank(bob);
        vm.expectRevert(IDuel.NotPlayer.selector);
        duel.cancel(id);
        vm.prank(alice);
        duel.cancel(id);
        _cash();
        assertEq(alice.balance, 10 ether);
        vm.prank(bob);
        vm.expectRevert(IDuel.WrongState.selector);
        duel.join{value: 1 ether}(id, deck);
    }

    function test_statsAreFrozenAtJoin() public {
        uint256 id = _start();
        // after the match starts, the weak card becomes the strongest; the match must still use the old stats
        cards.setCard(1, "", [uint8(99), 99, 99, 99, 99, 99]);
        _play(id, 0, 1);
        assertEq(duel.getMatch(id).winsA, 1);
        // a new match sees the update
        vm.prank(alice);
        uint256 id2 = duel.create{value: 1 ether}(deck);
        vm.prank(bob);
        duel.join{value: 1 ether}(id2, deck);
        _play(id2, 0, 1);
        assertEq(duel.getMatch(id2).winsB, 1);
    }

    function test_cardAddedAfterJoinIsNotPlayable() public {
        uint256 id = _start();
        cards.setCard(9, "new", [uint8(99), 99, 99, 99, 99, 99]);
        _commit(alice, id, 9, "sa");
        _commit(bob, id, 1, "sb");
        vm.prank(alice);
        vm.expectRevert(IDuel.BadCard.selector);
        duel.reveal(id, 9, "sa");
    }

    function test_onlyOwnerOrUpdaterSetsStats() public {
        vm.prank(bob);
        vm.expectRevert(ICardStats.NotAllowed.selector);
        cards.setCard(0, "x", [uint8(1), 1, 1, 1, 1, 1]);
        cards.setUpdater(bob);
        vm.prank(bob);
        cards.setCard(0, "x", [uint8(1), 1, 1, 1, 1, 1]);
        assertEq(cards.statsOf(0)[0], 1);
    }

    function _live() internal returns (uint256 id, address judge) {
        judge = makeAddr("judge");
        duel.setJudge(judge);
        id = _start();
        _play(id, 0, 1); // a wins
        _play(id, 1, 0); // b wins, so round 3 decides
        assertTrue(duel.getMatch(id).awaitingVerdict == false);
        _play(id, 2, 3); // equal stats, but this round goes to the judge
        assertTrue(duel.getMatch(id).awaitingVerdict);
    }

    function test_liveDuelJudgeDecides() public {
        (uint256 id, address judge) = _live();
        vm.prank(alice);
        vm.expectRevert(IDuel.NotJudge.selector);
        duel.settleLive(id, 1, "x");
        vm.prank(judge);
        vm.expectRevert(IDuel.BadOutcome.selector);
        duel.settleLive(id, 3, "x");
        vm.prank(judge);
        duel.settleLive(id, 2, keccak256("prompt|answerA|answerB|b"));
        _cash();
        assertEq(bob.balance, 11 ether);
        assertEq(address(duel).balance, 0);
    }

    function test_liveDuelFallsBackToStats() public {
        (uint256 id,) = _live();
        vm.expectRevert(IDuel.TooEarly.selector);
        duel.settleLiveByStats(id);
        // no timeout claim while waiting for the judge
        vm.warp(block.timestamp + 61);
        vm.expectRevert(IDuel.WrongState.selector);
        duel.claimTimeout(id);
        vm.warp(block.timestamp + 10 minutes);
        duel.settleLiveByStats(id);
        // equal stats in round 3: draw, both refunded
        _cash();
        assertEq(alice.balance, 10 ether);
        assertEq(bob.balance, 10 ether);
    }

    function test_noCommitsWhileWaitingForVerdict() public {
        (uint256 id,) = _live();
        vm.prank(alice);
        vm.expectRevert(IDuel.WrongState.selector);
        duel.commit(id, bytes32(uint256(1)));
    }

    function test_deckRules() public {
        // duplicate card
        vm.prank(alice);
        vm.expectRevert(IDuel.BadDeck.selector);
        duel.create{value: 1 ether}([uint16(0), 0, 1, 2, 3]);
        // card that does not exist
        vm.prank(alice);
        vm.expectRevert(IDuel.BadCard.selector);
        duel.create{value: 1 ether}([uint16(0), 1, 2, 3, 7]);
        // over the power cap
        duel.setDeckCap(1000);
        vm.prank(alice);
        vm.expectRevert(IDuel.BadDeck.selector);
        duel.create{value: 1 ether}(deck);
    }

    function test_canOnlyPlayFromDeck() public {
        cards.setCard(5, "extra", [uint8(20), 20, 20, 20, 20, 20]);
        vm.prank(alice);
        uint256 id = duel.create{value: 1 ether}(deck);
        vm.prank(bob);
        duel.join{value: 1 ether}(id, [uint16(1), 2, 3, 4, 5]);
        _commit(alice, id, 5, "sa");
        _commit(bob, id, 1, "sb");
        vm.prank(alice);
        vm.expectRevert(IDuel.NotInDeck.selector);
        duel.reveal(id, 5, "sa");
    }

    function test_typeTriangle() public {
        // reasoning type, speed type, cost type; same arena stat so only the triangle decides
        uint8[6] memory r = [uint8(50), 50, 90, 10, 10, 50];
        uint8[6] memory sp = [uint8(50), 50, 10, 90, 10, 50];
        uint8[6] memory c = [uint8(50), 50, 10, 10, 90, 50];
        assertEq(duel.typeOf(r), 0);
        assertEq(duel.typeOf(sp), 1);
        assertEq(duel.typeOf(c), 2);
    }

    function test_withdrawOnlyWhatIsOwed() public {
        vm.prank(alice);
        vm.expectRevert(IDuel.NothingOwed.selector);
        duel.withdraw();
        uint256 id = _start();
        _play(id, 0, 1);
        _play(id, 2, 4);
        assertEq(duel.owed(alice), 2 ether);
        assertEq(address(duel).balance, 2 ether);
        vm.prank(alice);
        duel.withdraw();
        assertEq(duel.owed(alice), 0);
        vm.prank(alice);
        vm.expectRevert(IDuel.NothingOwed.selector);
        duel.withdraw();
    }

    function test_aPlayerThatRejectsMoneyCannotBlockTheMatch() public {
        Rejecter r = new Rejecter(duel);
        vm.deal(address(r), 5 ether);
        uint256 id = r.create{value: 1 ether}(deck);
        vm.prank(bob);
        duel.join{value: 1 ether}(id, deck);
        // bob stalls nothing: the rejecter commits, bob never does, rejecter wins by timeout
        r.commit(id, keccak256(abi.encode(id, uint8(0), address(r), uint16(0), bytes32("s"))));
        vm.warp(block.timestamp + 61);
        duel.claimTimeout(id);
        assertEq(uint8(duel.getMatch(id).state), uint8(IDuel.State.Done));
        assertEq(duel.owed(address(r)), 2 ether);
    }
}

contract Rejecter {
    Duel duel;

    constructor(Duel d) {
        duel = d;
    }

    function create(uint16[5] calldata deck) external payable returns (uint256) {
        return duel.create{value: msg.value}(deck);
    }

    function commit(uint256 id, bytes32 c) external {
        duel.commit(id, c);
    }

    receive() external payable {
        revert("no");
    }
}
