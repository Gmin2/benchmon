// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

// lives on monad mainnet. aurora intents brings usdc from another chain and calls deposit(player, amount)
// from an intermediary account, so the money is credited to `player`, not to msg.sender. a player spends
// credit on a season pass; the game reads PassBought and unlocks the season. unspent credit can be withdrawn.
contract SeasonBank {
    using SafeTransferLib for address;

    address public immutable usdc;
    address public owner;
    uint256 public passPrice;
    uint256 public revenue;
    mapping(address => uint256) public credit;
    mapping(address => mapping(uint256 => bool)) public hasPass;

    event Deposited(address indexed player, address indexed from, uint256 amount);
    event PassBought(address indexed player, uint256 indexed season, uint256 price);
    event Withdrawn(address indexed player, uint256 amount);
    event PriceSet(uint256 price);

    error NotOwner();
    error NoCredit();
    error AlreadyHasPass();
    error ZeroAmount();

    constructor(address _usdc, uint256 _passPrice) {
        usdc = _usdc;
        owner = msg.sender;
        passPrice = _passPrice;
    }

    function setPassPrice(uint256 p) external {
        if (msg.sender != owner) revert NotOwner();
        passPrice = p;
        emit PriceSet(p);
    }

    function deposit(address player, uint256 amount) external {
        if (amount == 0 || player == address(0)) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        credit[player] += amount;
        emit Deposited(player, msg.sender, amount);
    }

    // deposit and buy in one call, which is what the aurora connect step runs after the bridge
    function depositAndBuy(address player, uint256 season) external {
        usdc.safeTransferFrom(msg.sender, address(this), passPrice);
        credit[player] += passPrice;
        emit Deposited(player, msg.sender, passPrice);
        _buy(player, season);
    }

    function buyPass(uint256 season) external {
        _buy(msg.sender, season);
    }

    function _buy(address player, uint256 season) internal {
        if (hasPass[player][season]) revert AlreadyHasPass();
        if (credit[player] < passPrice) revert NoCredit();
        credit[player] -= passPrice;
        revenue += passPrice;
        hasPass[player][season] = true;
        emit PassBought(player, season, passPrice);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0 || credit[msg.sender] < amount) revert NoCredit();
        credit[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function collect(address to) external {
        if (msg.sender != owner) revert NotOwner();
        uint256 r = revenue;
        revenue = 0;
        usdc.safeTransfer(to, r);
    }
}
