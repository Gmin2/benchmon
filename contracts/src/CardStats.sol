// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// stats per model card: code, math, reasoning, speed, cost, honesty (1 to 99)
contract CardStats {
    uint8 public constant STAT_COUNT = 6;

    address public owner;
    uint256 public cardCount;
    mapping(uint256 => uint8[6]) internal stats;
    mapping(uint256 => string) public names;

    event CardSet(uint256 indexed id, string name, uint8[6] stats);

    error NotOwner();
    error BadStat();
    error NoCard();

    constructor() {
        owner = msg.sender;
    }

    function setCard(uint256 id, string calldata name, uint8[6] calldata s) external {
        if (msg.sender != owner) revert NotOwner();
        for (uint256 i; i < STAT_COUNT; i++) {
            if (s[i] == 0 || s[i] > 99) revert BadStat();
        }
        if (id >= cardCount) cardCount = id + 1;
        stats[id] = s;
        names[id] = name;
        emit CardSet(id, name, s);
    }

    function statsOf(uint256 id) external view returns (uint8[6] memory) {
        if (id >= cardCount || stats[id][0] == 0) revert NoCard();
        return stats[id];
    }
}
