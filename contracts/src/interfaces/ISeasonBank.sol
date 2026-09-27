// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// mainnet usdc credit for season passes, funded through aurora intents
interface ISeasonBank {
    event Deposited(address indexed player, address indexed from, uint256 amount);
    event PassBought(address indexed player, uint256 indexed season, uint256 price);
    event Withdrawn(address indexed player, uint256 amount);
    event PriceSet(uint256 price);

    error NoCredit();
    error AlreadyHasPass();
    error ZeroAmount();

    function usdc() external view returns (address);
    function passPrice() external view returns (uint256);
    function revenue() external view returns (uint256);
    function credit(address player) external view returns (uint256);
    function hasPass(address player, uint256 season) external view returns (bool);

    function setPassPrice(uint256 p) external;
    function deposit(address player, uint256 amount) external;
    function depositAndBuy(address player, uint256 season) external;
    function buyPass(uint256 season) external;
    function withdraw(uint256 amount) external;
    function collect(address to) external;
}
