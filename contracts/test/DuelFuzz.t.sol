// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CardStats} from "../src/CardStats.sol";
import {Duel} from "../src/Duel.sol";

contract CardStatsFuzzTest is Test {
    function testFuzz_statsAtMatchesNaiveScan(uint8[20] memory writes, uint64 probe) public {
        CardStats c = new CardStats();
        uint64[] memory versions = new uint64[](20);
        uint8[] memory vals = new uint8[](20);
        uint256 n;
        for (uint256 i; i < 20; i++) {
            uint256 id = writes[i] % 3;
            uint8 v = uint8(bound(writes[i], 1, 99));
            c.setCard(id, "", [v, v, v, v, v, v]);
            if (id == 0) {
                versions[n] = c.version();
                vals[n] = v;
                n++;
            }
        }
        probe = uint64(bound(probe, 0, c.version()));
        uint8 want;
        bool found;
        for (uint256 i; i < n; i++) {
            if (versions[i] <= probe) {
                want = vals[i];
                found = true;
            }
        }
        if (!found) {
            vm.expectRevert(CardStats.NoCard.selector);
            c.statsAt(0, probe);
        } else {
            assertEq(c.statsAt(0, probe)[0], want);
        }
    }
}

contract DuelFuzzTest is Test {
    CardStats cards;
    Duel duel;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 constant CARDS = 8;

    function setUp() public {
        cards = new CardStats();
        duel = new Duel(cards, address(0));
        duel.setDeckCap(type(uint256).max);
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
    }

    function _seed(uint256 seed) internal {
        for (uint256 i; i < CARDS; i++) {
            uint8[6] memory s;
            for (uint256 j; j < 6; j++) {
                s[j] = uint8(bound(uint256(keccak256(abi.encode(seed, i, j))), 1, 99));
            }
            cards.setCard(i, "c", s);
        }
    }

    // independent re-implementation of the round scoring, including the type triangle
    function _scores(uint16 ca, uint16 cb, uint8 arena) internal view returns (uint256 a, uint256 b) {
        uint8[6] memory x = cards.statsOf(ca);
        uint8[6] memory y = cards.statsOf(cb);
        a = uint256(x[arena]) * 10;
        b = uint256(y[arena]) * 10;
        uint8 tx_ = x[2] >= x[3] && x[2] >= x[4] ? 0 : (x[3] >= x[4] ? 1 : 2);
        uint8 ty = y[2] >= y[3] && y[2] >= y[4] ? 0 : (y[3] >= y[4] ? 1 : 2);
        if ((tx_ + 1) % 3 == ty) a = a * 11 / 10;
        else if ((ty + 1) % 3 == tx_) b = b * 11 / 10;
    }

    function _start(uint256 stake) internal returns (uint256 id) {
        vm.prank(alice);
        id = duel.create{value: stake}([uint16(0), 1, 2, 6, 7]);
        vm.prank(bob);
        duel.join{value: stake}(id, [uint16(3), 4, 5, 6, 7]);
    }

    function _move(uint256 id, uint16 ca, uint16 cb, bytes32 sa, bytes32 sb) internal {
        uint8 round = duel.getMatch(id).round;
        vm.prank(alice);
        duel.commit(id, keccak256(abi.encode(id, round, alice, ca, sa)));
        vm.prank(bob);
        duel.commit(id, keccak256(abi.encode(id, round, bob, cb, sb)));
        vm.prank(alice);
        duel.reveal(id, ca, sa);
        vm.prank(bob);
        duel.reveal(id, cb, sb);
    }

    // any full match: money is conserved, nothing stays in the contract, and the payout matches the stats
    function testFuzz_fullMatchConservesMoney(uint256 seed, uint96 stakeRaw, bytes32 salt) public {
        _seed(seed);
        uint256 stake = bound(stakeRaw, 1, 10 ether);
        uint256 before = alice.balance + bob.balance;
        uint256 id = _start(stake);

        uint8 winsA;
        uint8 winsB;
        for (uint16 r; r < 3 && duel.getMatch(id).state == Duel.State.Playing; r++) {
            uint8 arena = duel.getMatch(id).arena;
            uint16 ca = r;
            uint16 cb = r + 3;
            (uint256 a, uint256 b) = _scores(ca, cb, arena);
            if (a > b) winsA++;
            else if (b > a) winsB++;
            _move(id, ca, cb, keccak256(abi.encode(salt, r, "a")), keccak256(abi.encode(salt, r, "b")));
        }

        assertEq(uint8(duel.getMatch(id).state), uint8(Duel.State.Done));
        assertEq(address(duel).balance, 0);
        assertEq(alice.balance + bob.balance, before);
        if (winsA > winsB) assertEq(alice.balance, 1000 ether + stake);
        else if (winsB > winsA) assertEq(bob.balance, 1000 ether + stake);
        else assertEq(alice.balance, 1000 ether);
    }

    // a reveal that does not match the commit never goes through
    function testFuzz_wrongRevealReverts(uint16 card, uint16 fake, bytes32 salt, bytes32 fakeSalt) public {
        _seed(1);
        vm.assume(card != fake || salt != fakeSalt);
        uint256 id = _start(1 ether);
        vm.prank(alice);
        duel.commit(id, keccak256(abi.encode(id, uint8(0), alice, card, salt)));
        vm.prank(bob);
        duel.commit(id, keccak256(abi.encode(id, uint8(0), bob, uint16(1), bytes32("b"))));
        vm.prank(alice);
        vm.expectRevert(Duel.BadReveal.selector);
        duel.reveal(id, fake, fakeSalt);
    }

    // a player who reveals any card id, real or not, must not be able to block the other side and win by timeout
    function testFuzz_cannotWinWithAFakeCard(uint16 fakeCard) public {
        _seed(2);
        fakeCard = uint16(bound(fakeCard, CARDS, type(uint16).max));
        uint256 id = _start(1 ether);
        vm.prank(alice);
        duel.commit(id, keccak256(abi.encode(id, uint8(0), alice, fakeCard, bytes32("a"))));
        vm.prank(bob);
        duel.commit(id, keccak256(abi.encode(id, uint8(0), bob, uint16(1), bytes32("b"))));
        vm.prank(alice);
        try duel.reveal(id, fakeCard, "a") {} catch {}
        vm.prank(bob);
        try duel.reveal(id, 1, "b") {} catch {}
        vm.warp(block.timestamp + 61);
        if (duel.getMatch(id).state == Duel.State.Playing) duel.claimTimeout(id);
        assertLe(alice.balance, 1000 ether, "a fake card won money");
    }
}

// random sequences of moves by two players and a stranger; the contract should always hold exactly
// the stakes of unfinished matches
contract Handler is Test {
    Duel public duel;
    address[3] actors;
    uint256[] public ids;
    uint256 public held;
    mapping(uint256 => uint256) public stakeOf;
    mapping(uint256 => bool) public counted;

    constructor(Duel _duel) {
        duel = _duel;
        actors = [makeAddr("p1"), makeAddr("p2"), makeAddr("p3")];
        for (uint256 i; i < 3; i++) {
            vm.deal(actors[i], 1e30);
        }
        // stakes are sent from this contract while pranking as an actor
        vm.deal(address(this), 1e30);
    }

    // five distinct cards out of 0..7 from a seed
    function _deck(uint256 seed) internal pure returns (uint16[5] memory d) {
        uint16 start = uint16(seed % 8);
        for (uint16 i; i < 5; i++) {
            d[i] = (start + i) % 8;
        }
    }

    function _actor(uint256 i) internal view returns (address) {
        return actors[i % 3];
    }

    function create(uint256 who, uint96 stake) external {
        stake = uint96(bound(stake, 1, 5 ether));
        vm.prank(_actor(who));
        uint256 id = duel.create{value: stake}(_deck(who + stake));
        ids.push(id);
        stakeOf[id] = stake;
    }

    function join(uint256 who, uint256 pick) external {
        if (ids.length == 0) return;
        uint256 id = ids[pick % ids.length];
        vm.prank(_actor(who));
        try duel.join{value: stakeOf[id]}(id, _deck(who * 7 + pick)) {} catch {}
    }

    function commit(uint256 who, uint256 pick, uint16 card, bytes32 salt) external {
        if (ids.length == 0) return;
        uint256 id = ids[pick % ids.length];
        card = uint16(bound(card, 0, 9));
        address p = _actor(who);
        uint8 round = duel.getMatch(id).round;
        vm.prank(p);
        try duel.commit(id, keccak256(abi.encode(id, round, p, card, salt))) {} catch {}
        lastCard[id][p] = card;
        lastSalt[id][p] = salt;
    }

    mapping(uint256 => mapping(address => uint16)) lastCard;
    mapping(uint256 => mapping(address => bytes32)) lastSalt;

    function reveal(uint256 who, uint256 pick) external {
        if (ids.length == 0) return;
        uint256 id = ids[pick % ids.length];
        address p = _actor(who);
        vm.prank(p);
        try duel.reveal(id, lastCard[id][p], lastSalt[id][p]) {} catch {}
    }

    // both players of a live match commit and reveal in one go, with cards that may be fake or reused
    function playRound(uint256 pick, uint16 ca, uint16 cb, bytes32 sa, bytes32 sb, bool skipB) external {
        if (ids.length == 0) return;
        uint256 id = ids[pick % ids.length];
        Duel.Match memory m = duel.getMatch(id);
        if (m.state != Duel.State.Playing) return;
        ca = uint16(bound(ca, 0, 9));
        cb = uint16(bound(cb, 0, 9));
        vm.prank(m.a);
        try duel.commit(id, keccak256(abi.encode(id, m.round, m.a, ca, sa))) {} catch {}
        vm.prank(m.b);
        try duel.commit(id, keccak256(abi.encode(id, m.round, m.b, cb, sb))) {} catch {}
        vm.prank(m.a);
        try duel.reveal(id, ca, sa) {} catch {}
        if (skipB) return;
        vm.prank(m.b);
        try duel.reveal(id, cb, sb) {} catch {}
        if (duel.getMatch(id).round > m.round) roundsPlayed++;
        if (duel.getMatch(id).state == Duel.State.Done) finished++;
    }

    uint256 public roundsPlayed;
    uint256 public finished;

    function verdict(uint256 pick, uint8 outcome, bytes32 h) external {
        if (ids.length == 0) return;
        try duel.settleLive(ids[pick % ids.length], outcome % 4, h) {} catch {}
    }

    function verdictByStats(uint256 pick, uint16 secs) external {
        if (ids.length == 0) return;
        vm.warp(block.timestamp + secs);
        try duel.settleLiveByStats(ids[pick % ids.length]) {} catch {}
    }

    // plays fresh valid cards round after round until the match waits for a verdict or ends
    function playToLive(uint256 pick, uint256 seed) external {
        if (ids.length == 0) return;
        uint256 id = ids[pick % ids.length];
        for (uint16 r; r < 3; r++) {
            Duel.Match memory m = duel.getMatch(id);
            if (m.state != Duel.State.Playing || m.awaitingVerdict || m.commitA != 0 || m.commitB != 0) return;
            uint16 ca = _pickFrom(m.deckA & ~m.usedA, seed + r);
            uint16 cb = _pickFrom(m.deckB & ~m.usedB, seed / 7 + r);
            bytes32 sa = keccak256(abi.encode(seed, r, 1));
            bytes32 sb = keccak256(abi.encode(seed, r, 2));
            vm.prank(m.a);
            duel.commit(id, keccak256(abi.encode(id, m.round, m.a, ca, sa)));
            vm.prank(m.b);
            duel.commit(id, keccak256(abi.encode(id, m.round, m.b, cb, sb)));
            vm.prank(m.a);
            duel.reveal(id, ca, sa);
            vm.prank(m.b);
            duel.reveal(id, cb, sb);
        }
    }

    function _pickFrom(uint256 bits, uint256 seed) internal pure returns (uint16) {
        uint16[8] memory opts;
        uint256 n;
        for (uint16 i; i < 8; i++) {
            if (bits & (1 << i) != 0) opts[n++] = i;
        }
        return opts[seed % n];
    }

    function cancel(uint256 who, uint256 pick) external {
        if (ids.length == 0) return;
        vm.prank(_actor(who));
        try duel.cancel(ids[pick % ids.length]) {} catch {}
    }

    function done() external view returns (uint256 n, uint256 rounds) {
        for (uint256 i; i < ids.length; i++) {
            Duel.Match memory m = duel.getMatch(ids[i]);
            if (m.state == Duel.State.Done) n++;
            rounds += m.round;
        }
    }

    function timeout(uint256 pick, uint8 secs) external {
        if (ids.length == 0) return;
        vm.warp(block.timestamp + secs);
        try duel.claimTimeout(ids[pick % ids.length]) {} catch {}
    }

    function expected() external view returns (uint256 sum) {
        for (uint256 i; i < ids.length; i++) {
            Duel.Match memory m = duel.getMatch(ids[i]);
            if (m.state == Duel.State.Open) sum += m.stake;
            else if (m.state == Duel.State.Playing) sum += 2 * m.stake;
        }
    }
}

contract DuelInvariantTest is Test {
    Duel duel;
    Handler handler;

    function setUp() public {
        CardStats cards = new CardStats();
        // cards 0 to 7 exist, 8 and 9 do not, so the handler also tries fake cards
        for (uint256 i; i < 8; i++) {
            cards.setCard(
                i, "c", [uint8(10 + i * 10), uint8(90 - i * 10), 50, uint8(20 + i * 5), 60, uint8(30 + i * 7)]
            );
        }
        duel = new Duel(cards, address(this));
        handler = new Handler(duel);
        duel.setJudge(address(handler));
        targetContract(address(handler));
        bytes4[] memory sel = new bytes4[](10);
        sel[0] = Handler.create.selector;
        sel[1] = Handler.join.selector;
        sel[2] = Handler.commit.selector;
        sel[3] = Handler.reveal.selector;
        sel[4] = Handler.playRound.selector;
        sel[5] = Handler.cancel.selector;
        sel[6] = Handler.timeout.selector;
        sel[7] = Handler.verdict.selector;
        sel[8] = Handler.verdictByStats.selector;
        sel[9] = Handler.playToLive.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: sel}));
    }

    function invariant_balanceEqualsOpenStakes() public view {
        assertEq(address(duel).balance, handler.expected());
    }
}
