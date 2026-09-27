// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "solady/auth/Ownable.sol";
import {ICardStats} from "./interfaces/ICardStats.sol";

// stats per model card: code, math, reasoning, speed, cost, honesty (1 to 99).
// every update bumps a global version and keeps history, so a match can read the
// stats as they were when it started, even if the oracle updates them mid match.
contract CardStats is ICardStats, Ownable {
    uint8 public constant STAT_COUNT = 6;

    struct Entry {
        uint64 version;
        uint8[6] stats;
    }

    address public updater;
    uint64 public version;
    uint256 public cardCount;
    mapping(uint256 => Entry[]) internal history;
    mapping(uint256 => string) public names;

    constructor() {
        _initializeOwner(msg.sender);
    }

    function setUpdater(address u) external onlyOwner {
        updater = u;
        emit UpdaterSet(u);
    }

    function setCard(uint256 id, string calldata name, uint8[6] calldata s) external {
        if (msg.sender != owner() && msg.sender != updater) revert NotAllowed();
        _set(id, name, s);
    }

    function _set(uint256 id, string memory name, uint8[6] memory s) internal {
        for (uint256 i; i < STAT_COUNT; i++) {
            if (s[i] == 0 || s[i] > 99) revert BadStat();
        }
        if (id >= cardCount) cardCount = id + 1;
        uint64 v = ++version;
        history[id].push(Entry(v, s));
        if (bytes(name).length != 0) names[id] = name;
        emit CardSet(id, v, name, s);
    }

    function statsOf(uint256 id) external view returns (uint8[6] memory) {
        Entry[] storage h = history[id];
        if (h.length == 0) revert NoCard();
        return h[h.length - 1].stats;
    }

    // stats as of a version: the newest entry with entry.version <= v
    function statsAt(uint256 id, uint64 v) external view returns (uint8[6] memory) {
        Entry[] storage h = history[id];
        uint256 lo;
        uint256 hi = h.length;
        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            if (h[mid].version <= v) lo = mid + 1;
            else hi = mid;
        }
        if (lo == 0) revert NoCard();
        return h[lo - 1].stats;
    }

    function exists(uint256 id, uint64 v) external view returns (bool) {
        Entry[] storage h = history[id];
        return h.length != 0 && h[0].version <= v;
    }
}
