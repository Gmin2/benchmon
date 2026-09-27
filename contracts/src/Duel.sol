// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CardStats} from "./CardStats.sol";

// two players stake the same amount, play 3 rounds of hidden card picks.
// each round has an arena (one of the six stats); the higher stat wins the round.
// best of 3 takes the pot, a drawn match refunds both.
// the third round is the live duel: both chosen models answer the same prompt off chain and the
// judge posts the verdict with a hash of prompt, answers and verdict. if the judge goes quiet,
// anyone can settle that round by stats after VERDICT_TIMEOUT, so money is never stuck.
contract Duel {
    uint8 public constant ROUNDS = 3;
    uint8 public constant LIVE_ROUND = 2;
    uint256 public constant MOVE_TIMEOUT = 60;
    uint256 public constant VERDICT_TIMEOUT = 10 minutes;

    enum State {
        Open,
        Playing,
        Done
    }

    struct Match {
        address a;
        address b;
        uint256 stake;
        State state;
        uint8 round;
        uint8 winsA;
        uint8 winsB;
        uint8 arena;
        uint64 deadline;
        bytes32 commitA;
        bytes32 commitB;
        bool revealedA;
        bool revealedB;
        uint16 cardA;
        uint16 cardB;
        bytes32 seed;
        uint256 usedA;
        uint256 usedB;
        uint64 statsVersion;
        bool awaitingVerdict;
    }

    CardStats public immutable cards;
    address public owner;
    address public judge;
    uint256 public matchCount;
    mapping(uint256 => Match) internal matches;

    event Created(uint256 indexed id, address indexed a, uint256 stake);
    event Joined(uint256 indexed id, address indexed b, uint8 arena);
    event Committed(uint256 indexed id, address indexed player, uint8 round);
    event Revealed(uint256 indexed id, address indexed player, uint8 round, uint16 card);
    event RoundWon(uint256 indexed id, uint8 round, address winner, uint8 nextArena);
    event Finished(uint256 indexed id, address winner, uint256 payout);
    event Cancelled(uint256 indexed id);
    event LiveDuel(uint256 indexed id, uint16 cardA, uint16 cardB, uint8 arena);
    event Verdict(uint256 indexed id, uint8 outcome, bytes32 duelHash, bool byJudge);
    event JudgeSet(address judge);

    error WrongState();
    error WrongStake();
    error NotPlayer();
    error AlreadyCommitted();
    error NotCommitted();
    error BadReveal();
    error CardUsed();
    error TooEarly();
    error BadCard();
    error NotJudge();
    error BadOutcome();

    constructor(CardStats _cards, address _judge) {
        cards = _cards;
        owner = msg.sender;
        judge = _judge;
    }

    function setJudge(address j) external {
        if (msg.sender != owner) revert NotJudge();
        judge = j;
        emit JudgeSet(j);
    }

    function getMatch(uint256 id) external view returns (Match memory) {
        return matches[id];
    }

    function create() external payable returns (uint256 id) {
        if (msg.value == 0) revert WrongStake();
        id = matchCount++;
        Match storage m = matches[id];
        m.a = msg.sender;
        m.stake = msg.value;
        emit Created(id, msg.sender, msg.value);
    }

    function join(uint256 id) external payable {
        Match storage m = matches[id];
        if (m.state != State.Open || m.a == address(0)) revert WrongState();
        if (msg.value != m.stake) revert WrongStake();
        if (msg.sender == m.a) revert NotPlayer();
        m.b = msg.sender;
        m.state = State.Playing;
        m.seed = keccak256(abi.encode(id, m.a, msg.sender, block.prevrandao));
        m.statsVersion = cards.version();
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
        _pay(m.a, m.stake);
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
        Match storage m = matches[id];
        if (m.state != State.Playing) revert WrongState();
        if (m.commitA == 0 || m.commitB == 0) revert NotCommitted();
        bytes32 c = keccak256(abi.encode(id, m.round, msg.sender, card, salt));
        bool isA = msg.sender == m.a;
        if (!isA && msg.sender != m.b) revert NotPlayer();
        if (isA ? (m.revealedA || c != m.commitA) : (m.revealedB || c != m.commitB)) revert BadReveal();
        // a card that does not exist would make the round unsettleable and hand the other side a timeout win
        if (card > 255 || !cards.exists(card, m.statsVersion)) revert BadCard();
        uint256 bit = 1 << card;
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
        emit Revealed(id, msg.sender, m.round, card);
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
        uint8 sa = cards.statsAt(m.cardA, m.statsVersion)[m.arena];
        uint8 sb = cards.statsAt(m.cardB, m.statsVersion)[m.arena];
        if (sa > sb) return 1;
        if (sb > sa) return 2;
        return 0;
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
        uint256 pot = m.stake * 2;
        if (winner == address(0)) {
            _pay(m.a, m.stake);
            _pay(m.b, m.stake);
        } else {
            _pay(winner, pot);
        }
        emit Finished(id, winner, winner == address(0) ? 0 : pot);
    }

    function _pay(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "pay failed");
    }
}
