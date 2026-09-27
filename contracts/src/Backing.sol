// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Duel} from "./Duel.sol";

// spectators back player a or b of a match. when the match ends the backers of the winner split the
// whole pool pro rata. a draw, a cancel, or a side nobody backed refunds everyone.
contract Backing {
    Duel public immutable duel;

    mapping(uint256 => uint256[3]) public totals; // [unused, side a, side b]
    mapping(uint256 => mapping(address => uint256[3])) public backed;

    event Backed(uint256 indexed id, address indexed who, uint8 side, uint256 amount);
    event Claimed(uint256 indexed id, address indexed who, uint256 amount);

    error Closed();
    error BadSide();
    error NotFinished();
    error NothingToClaim();

    constructor(Duel _duel) {
        duel = _duel;
    }

    function back(uint256 id, uint8 side) external payable {
        if (side != 1 && side != 2) revert BadSide();
        if (msg.value == 0) revert NothingToClaim();
        if (!duel.bettingOpen(id)) revert Closed();
        totals[id][side] += msg.value;
        backed[id][msg.sender][side] += msg.value;
        emit Backed(id, msg.sender, side, msg.value);
    }

    function claimable(uint256 id, address who) public view returns (uint256) {
        uint8 r = duel.resultOf(id);
        if (r == 0) return 0;
        uint256 a = backed[id][who][1];
        uint256 b = backed[id][who][2];
        uint256[3] memory t = totals[id];
        if (r == 3 || t[r] == 0) return a + b;
        uint256 mine = r == 1 ? a : b;
        return mine * (t[1] + t[2]) / t[r];
    }

    function claim(uint256 id) external {
        if (duel.resultOf(id) == 0) revert NotFinished();
        uint256 amount = claimable(id, msg.sender);
        if (amount == 0) revert NothingToClaim();
        delete backed[id][msg.sender];
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "pay failed");
        emit Claimed(id, msg.sender, amount);
    }
}
