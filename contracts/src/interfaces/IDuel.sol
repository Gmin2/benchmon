// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICardStats} from "./ICardStats.sol";

/// staked best of 3 card matches with commit reveal picks and a judged live round
interface IDuel {
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
        uint256 deckA;
        uint256 deckB;
        // 0 not finished, 1 a won, 2 b won, 3 draw or cancelled
        uint8 result;
    }

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
    event DeckCapSet(uint256 cap);
    event Withdrawn(address indexed who, uint256 amount);

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
    error BadDeck();
    error NotInDeck();
    error NothingOwed();

    function cards() external view returns (ICardStats);
    function judge() external view returns (address);
    function deckCap() external view returns (uint256);
    function matchCount() external view returns (uint256);
    function owed(address who) external view returns (uint256);

    function create(uint16[5] calldata deck) external payable returns (uint256 id);
    function join(uint256 id, uint16[5] calldata deck) external payable;
    function cancel(uint256 id) external;
    function commit(uint256 id, bytes32 c) external;
    function reveal(uint256 id, uint16 card, bytes32 salt) external;
    function claimTimeout(uint256 id) external;
    function settleLive(uint256 id, uint8 outcome, bytes32 duelHash) external;
    function settleLiveByStats(uint256 id) external;
    function withdraw() external;

    function setJudge(address j) external;
    function setDeckCap(uint256 cap) external;

    function getMatch(uint256 id) external view returns (Match memory);
    function resultOf(uint256 id) external view returns (uint8);
    function bettingOpen(uint256 id) external view returns (bool);
    function typeOf(uint8[6] memory s) external pure returns (uint8);
}
