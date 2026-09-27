// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "solady/auth/Ownable.sol";
import {IDuel} from "./interfaces/IDuel.sol";
import {ICardStats} from "./interfaces/ICardStats.sol";

// two players stake the same amount, play 3 rounds of hidden card picks.
// each round has an arena (one of the six stats); the higher stat wins the round.
// best of 3 takes the pot, a drawn match refunds both.
// the third round is the live duel: both chosen models answer the same prompt off chain and the
// judge posts the verdict with a hash of prompt, answers and verdict. if the judge goes quiet,
// anyone can settle that round by stats after VERDICT_TIMEOUT, so money is never stuck.
// payouts are credited and withdrawn by the player, so a player that cannot receive MON cannot block a match.
contract Duel is IDuel, Ownable {
    uint8 public constant ROUNDS = 3;
    uint8 public constant LIVE_ROUND = 2;
    uint256 public constant MOVE_TIMEOUT = 120;
    uint256 public constant VERDICT_TIMEOUT = 10 minutes;
    uint8 public constant DECK_SIZE = 5;

    ICardStats public immutable cards;
    address public judge;
    // total power (sum of all six stats) a deck of five may have, so nobody just brings the five strongest models
    uint256 public deckCap = 1900;
    uint256 public matchCount;
    mapping(uint256 => Match) internal matches;
    mapping(address => uint256) public owed;

    constructor(ICardStats _cards, address _judge) {
        cards = _cards;
        judge = _judge;
        _initializeOwner(msg.sender);
    }

    function setDeckCap(uint256 cap) external onlyOwner {
        deckCap = cap;
        emit DeckCapSet(cap);
    }

    function setJudge(address j) external onlyOwner {
        judge = j;
        emit JudgeSet(j);
    }

    function getMatch(uint256 id) external view returns (Match memory) {
        return matches[id];
    }

    function resultOf(uint256 id) external view returns (uint8) {
        return matches[id].result;
    }

    // spectators can back a side until the first card of the match is revealed
    function bettingOpen(uint256 id) external view returns (bool) {
        Match storage m = matches[id];
        if (m.a == address(0)) return false;
        if (m.state == State.Open) return true;
        return m.state == State.Playing && m.round == 0 && !m.revealedA && !m.revealedB;
    }

    function create(uint16[5] calldata deck) external payable returns (uint256 id) {
        if (msg.value == 0) revert WrongStake();
        uint256 bits = _deckBits(deck);
        _checkDeck(bits, cards.version());
        id = matchCount++;
        Match storage m = matches[id];
        m.a = msg.sender;
        m.stake = msg.value;
        m.deckA = bits;
        emit Created(id, msg.sender, msg.value);
    }

    function join(uint256 id, uint16[5] calldata deck) external payable {
        Match storage m = matches[id];
        if (m.state != State.Open || m.a == address(0)) revert WrongState();
        if (msg.value != m.stake) revert WrongStake();
        if (msg.sender == m.a) revert NotPlayer();
        m.b = msg.sender;
        m.state = State.Playing;
        m.seed = keccak256(abi.encode(id, m.a, msg.sender, block.prevrandao));
        m.statsVersion = cards.version();
        // both decks are checked against the stats this match will use
        m.deckB = _deckBits(deck);
        _checkDeck(m.deckA, m.statsVersion);
        _checkDeck(m.deckB, m.statsVersion);
        m.arena = uint8(uint256(m.seed) % 6);
        m.deadline = uint64(block.timestamp + MOVE_TIMEOUT);
        emit Joined(id, msg.sender, m.arena);
    }

    // the creator can take the stake back while nobody has joined
    function cancel(uint256 id) external {
        Match storage m = matches[id];
        if (m.state != State.Open || m.a == address(0)) revert WrongState();
        if (msg.sender != m.a) revert NotPlayer();
        m.state = State.Done;
        m.result = 3;
        owed[m.a] += m.stake;
        emit Cancelled(id);
    }

    // commit = keccak256(abi.encode(id, round, player, card, salt))
    function commit(uint256 id, bytes32 c) external {
        Match storage m = matches[id];
        if (m.state != State.Playing || m.awaitingVerdict) revert WrongState();
        if (msg.sender == m.a) {
            if (m.commitA != 0) revert AlreadyCommitted();
            m.commitA = c;
        } else if (msg.sender == m.b) {
            if (m.commitB != 0) revert AlreadyCommitted();
            m.commitB = c;
        } else {
            revert NotPlayer();
        }
        if (m.commitA != 0 && m.commitB != 0) m.deadline = uint64(block.timestamp + MOVE_TIMEOUT);
        emit Committed(id, msg.sender, m.round);
    }

    function reveal(uint256 id, uint16 card, bytes32 salt) external {
        _reveal(id, msg.sender, card, salt);
    }

    // anyone holding the card and salt can reveal for a player: the commit binds the player address, so only the
    // real pick can pass. this lets a relayer reveal while the player's tab is closed or in the background.
    function revealFor(uint256 id, address player, uint16 card, bytes32 salt) external {
        _reveal(id, player, card, salt);
    }

    function _reveal(uint256 id, address player, uint16 card, bytes32 salt) internal {
        Match storage m = matches[id];
        if (m.state != State.Playing) revert WrongState();
        if (m.commitA == 0 || m.commitB == 0) revert NotCommitted();
        bytes32 c = keccak256(abi.encode(id, m.round, player, card, salt));
        bool isA = player == m.a;
        if (!isA && player != m.b) revert NotPlayer();
        if (isA ? (m.revealedA || c != m.commitA) : (m.revealedB || c != m.commitB)) revert BadReveal();
        // a card that does not exist would make the round unsettleable and hand the other side a timeout win
        if (card > 255 || !cards.exists(card, m.statsVersion)) revert BadCard();
        uint256 bit = 1 << card;
        if ((isA ? m.deckA : m.deckB) & bit == 0) revert NotInDeck();
        if (isA) {
            if (m.usedA & bit != 0) revert CardUsed();
            m.usedA |= bit;
            m.revealedA = true;
            m.cardA = card;
        } else {
            if (m.usedB & bit != 0) revert CardUsed();
            m.usedB |= bit;
            m.revealedB = true;
            m.cardB = card;
        }
        m.seed = keccak256(abi.encode(m.seed, salt));
        emit Revealed(id, player, m.round, card);
        if (m.revealedA && m.revealedB) _settleRound(id, m);
    }

    // if the other side stalls past the deadline, the player who moved takes the match
    function claimTimeout(uint256 id) external {
        Match storage m = matches[id];
        if (m.state != State.Playing || m.awaitingVerdict) revert WrongState();
        if (block.timestamp <= m.deadline) revert TooEarly();
        bool aMoved = m.commitB == 0 ? m.commitA != 0 : m.revealedA;
        bool bMoved = m.commitA == 0 ? m.commitB != 0 : m.revealedB;
        address winner;
        if (aMoved && !bMoved) winner = m.a;
        else if (bMoved && !aMoved) winner = m.b;
        _finish(id, m, winner);
    }

    // outcome: 0 draw, 1 a wins the round, 2 b wins it
    function settleLive(uint256 id, uint8 outcome, bytes32 duelHash) external {
        if (msg.sender != judge) revert NotJudge();
        Match storage m = matches[id];
        if (m.state != State.Playing || !m.awaitingVerdict) revert WrongState();
        if (outcome > 2) revert BadOutcome();
        m.awaitingVerdict = false;
        emit Verdict(id, outcome, duelHash, true);
        _advance(id, m, outcome);
    }

    function settleLiveByStats(uint256 id) external {
        Match storage m = matches[id];
        if (m.state != State.Playing || !m.awaitingVerdict) revert WrongState();
        if (block.timestamp <= m.deadline) revert TooEarly();
        m.awaitingVerdict = false;
        uint8 outcome = _byStats(m);
        emit Verdict(id, outcome, bytes32(0), false);
        _advance(id, m, outcome);
    }

    function _settleRound(uint256 id, Match storage m) internal {
        if (m.round == LIVE_ROUND && judge != address(0)) {
            m.awaitingVerdict = true;
            m.deadline = uint64(block.timestamp + VERDICT_TIMEOUT);
            emit LiveDuel(id, m.cardA, m.cardB, m.arena);
            return;
        }
        _advance(id, m, _byStats(m));
    }

    function _byStats(Match storage m) internal view returns (uint8) {
        uint8[6] memory a = cards.statsAt(m.cardA, m.statsVersion);
        uint8[6] memory b = cards.statsAt(m.cardB, m.statsVersion);
        uint256 sa = uint256(a[m.arena]) * 10;
        uint256 sb = uint256(b[m.arena]) * 10;
        uint8 ta = typeOf(a);
        uint8 tb = typeOf(b);
        // reasoning beats speed, speed beats cost, cost beats reasoning: +10%
        if ((ta + 1) % 3 == tb) sa = sa * 11 / 10;
        else if ((tb + 1) % 3 == ta) sb = sb * 11 / 10;
        if (sa > sb) return 1;
        if (sb > sa) return 2;
        return 0;
    }

    // 0 reasoning, 1 speed, 2 cost: whichever of the three is highest, ties go to the earlier one
    function typeOf(uint8[6] memory s) public pure returns (uint8) {
        if (s[2] >= s[3] && s[2] >= s[4]) return 0;
        if (s[3] >= s[4]) return 1;
        return 2;
    }

    function _deckBits(uint16[5] calldata deck) internal pure returns (uint256 bits) {
        for (uint256 i; i < DECK_SIZE; i++) {
            if (deck[i] > 255) revert BadDeck();
            uint256 bit = 1 << deck[i];
            if (bits & bit != 0) revert BadDeck();
            bits |= bit;
        }
    }

    function _checkDeck(uint256 bits, uint64 v) internal view {
        uint256 power;
        for (uint256 id; bits != 0; id++) {
            if (bits & 1 != 0) {
                if (!cards.exists(id, v)) revert BadCard();
                uint8[6] memory s = cards.statsAt(id, v);
                power += uint256(s[0]) + s[1] + s[2] + s[3] + s[4] + s[5];
            }
            bits >>= 1;
        }
        if (power > deckCap) revert BadDeck();
    }

    function _advance(uint256 id, Match storage m, uint8 outcome) internal {
        address roundWinner;
        if (outcome == 1) {
            m.winsA++;
            roundWinner = m.a;
        } else if (outcome == 2) {
            m.winsB++;
            roundWinner = m.b;
        }
        m.round++;
        m.commitA = 0;
        m.commitB = 0;
        m.revealedA = false;
        m.revealedB = false;
        m.arena = uint8(uint256(m.seed) % 6);
        m.deadline = uint64(block.timestamp + MOVE_TIMEOUT);
        emit RoundWon(id, m.round - 1, roundWinner, m.arena);

        if (m.winsA == 2 || m.winsB == 2 || m.round == ROUNDS) {
            address winner;
            if (m.winsA > m.winsB) winner = m.a;
            else if (m.winsB > m.winsA) winner = m.b;
            _finish(id, m, winner);
        }
    }

    function _finish(uint256 id, Match storage m, address winner) internal {
        m.state = State.Done;
        m.result = winner == m.a ? 1 : winner == m.b ? 2 : 3;
        uint256 pot = m.stake * 2;
        if (winner == address(0)) {
            owed[m.a] += m.stake;
            owed[m.b] += m.stake;
        } else {
            owed[winner] += pot;
        }
        emit Finished(id, winner, winner == address(0) ? 0 : pot);
    }

    function withdraw() external {
        uint256 amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed();
        owed[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "pay failed");
    }
}
