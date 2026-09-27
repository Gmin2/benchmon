// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDuel} from "./IDuel.sol";

/// spectators back a side of a match, winners split the pool
interface IBacking {
    event Backed(uint256 indexed id, address indexed who, uint8 side, uint256 amount);
    event Claimed(uint256 indexed id, address indexed who, uint256 amount);

    error Closed();
    error BadSide();
    error NotFinished();
    error NothingToClaim();

    function duel() external view returns (IDuel);
    function totals(uint256 id, uint256 side) external view returns (uint256);
    function backed(uint256 id, address who, uint256 side) external view returns (uint256);

    function back(uint256 id, uint8 side) external payable;
    function claimable(uint256 id, address who) external view returns (uint256);
    function claim(uint256 id) external;
}
