// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// model card stats: code, math, reasoning, speed, cost, honesty, each 1 to 99, with versioned history
interface ICardStats {
    event CardSet(uint256 indexed id, uint64 version, string name, uint8[6] stats);
    event UpdaterSet(address updater);

    error BadStat();
    error NoCard();
    error NotAllowed();

    function version() external view returns (uint64);
    function cardCount() external view returns (uint256);
    function updater() external view returns (address);
    function names(uint256 id) external view returns (string memory);

    function setUpdater(address u) external;
    function setCard(uint256 id, string calldata name, uint8[6] calldata stats) external;

    function statsOf(uint256 id) external view returns (uint8[6] memory);
    function statsAt(uint256 id, uint64 v) external view returns (uint8[6] memory);
    function exists(uint256 id, uint64 v) external view returns (bool);
}
