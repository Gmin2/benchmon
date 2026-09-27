// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDuel} from "./IDuel.sol";

/// one house seeded lmsr market per match
interface IMatchMarket {
    event Opened(uint256 indexed id, uint256 b, uint256 seed);
    event Traded(uint256 indexed id, address indexed who, uint8 side, int256 shares, int256 cost, uint256 priceA);
    event Redeemed(uint256 indexed id, address indexed who, uint256 amount);
    event HouseSettled(uint256 indexed id, uint256 amount);

    error AlreadyOpen();
    error NoMarket();
    error Closed();
    error BadSide();
    error TooLittle();
    error NotFinished();

    function duel() external view returns (IDuel);
    function shares(uint256 id, address who, uint256 side) external view returns (uint256);

    function open(uint256 id, uint256 b) external payable;
    function buy(uint256 id, uint8 side, uint256 amount) external payable;
    function sell(uint256 id, uint8 side, uint256 amount) external;
    function redeem(uint256 id) external;
    function houseSettle(uint256 id) external;

    function maxLoss(uint256 b) external pure returns (uint256);
    function cost(uint256 b, uint256 qA, uint256 qB) external pure returns (uint256);
    function priceA(uint256 id) external view returns (uint256);
    function redeemable(uint256 id, address who) external view returns (uint256);
}
