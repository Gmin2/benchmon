// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FixedPointMathLib as M} from "solady/utils/FixedPointMathLib.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {IMatchMarket} from "./interfaces/IMatchMarket.sol";
import {IDuel} from "./interfaces/IDuel.sol";

// one small prediction market per match (lmsr). the house seeds it with liquidity b and can lose at most
// b * ln 2. a share of the winning side pays 1 MON, a draw or a cancel pays 0.5 MON per share on either side.
// trading follows the same window as backing: open until the first card of the match is revealed.
// the owner is the house.
contract MatchMarket is IMatchMarket, Ownable {
    struct Market {
        uint256 b; // liquidity, wad
        uint256 qA; // shares sold on a, wad
        uint256 qB;
        uint256 collateral; // everything paid in, including the house seed
        uint256 paidOut;
        bool settledHouse;
    }

    // below this the exp and ln rounding is larger than the trade itself
    uint256 public constant MIN_TRADE = 1e12;

    IDuel public immutable duel;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256[3])) public shares; // [unused, a, b]

    constructor(IDuel _duel) {
        duel = _duel;
        _initializeOwner(msg.sender);
    }

    // the house seeds a market; the seed must cover the worst case loss b * ln 2
    function open(uint256 id, uint256 b) external payable onlyOwner {
        if (markets[id].b != 0) revert AlreadyOpen();
        if (!duel.bettingOpen(id)) revert Closed();
        if (b == 0 || msg.value < maxLoss(b)) revert TooLittle();
        markets[id].b = b;
        markets[id].collateral = msg.value;
        emit Opened(id, b, msg.value);
    }

    function maxLoss(uint256 b) public pure returns (uint256) {
        // ln 2 in wad, rounded up
        return M.mulWadUp(b, 693147180559945310);
    }

    // cost function C(q) = b ln(e^(qA/b) + e^(qB/b)), computed as max + b ln(sum of e^((q - max)/b))
    function cost(uint256 b, uint256 qA, uint256 qB) public pure returns (uint256) {
        uint256 hi = qA > qB ? qA : qB;
        int256 ea = M.expWad(-int256(M.divWad(hi - qA, b)));
        int256 eb = M.expWad(-int256(M.divWad(hi - qB, b)));
        int256 l = M.lnWad(ea + eb);
        return hi + M.mulWad(b, uint256(l));
    }

    function priceA(uint256 id) public view returns (uint256) {
        Market storage m = markets[id];
        if (m.b == 0) return 0.5e18;
        int256 d = (int256(m.qB) - int256(m.qA)) * 1e18 / int256(m.b);
        // pA = 1 / (1 + e^((qB - qA)/b))
        if (d > 100e18) return 0;
        if (d < -100e18) return 1e18;
        return M.divWad(1e18, 1e18 + uint256(M.expWad(d)));
    }

    // buy `amount` shares of a side, paying the cost difference (rounded up by one wei), excess is refunded
    function buy(uint256 id, uint8 side, uint256 amount) external payable {
        Market storage m = _live(id, side);
        if (amount < MIN_TRADE) revert TooLittle();
        uint256 before = cost(m.b, m.qA, m.qB);
        if (side == 1) m.qA += amount;
        else m.qB += amount;
        uint256 afterCost = cost(m.b, m.qA, m.qB);
        uint256 price = (afterCost > before ? afterCost - before : 0) + 1;
        if (msg.value < price) revert TooLittle();
        m.collateral += price;
        shares[id][msg.sender][side] += amount;
        emit Traded(id, msg.sender, side, int256(amount), int256(price), priceA(id));
        if (msg.value > price) _pay(msg.sender, msg.value - price);
    }

    // sell shares back before the market closes, receiving the cost difference (rounded down by one wei)
    function sell(uint256 id, uint8 side, uint256 amount) external {
        Market storage m = _live(id, side);
        if (amount < MIN_TRADE || shares[id][msg.sender][side] < amount) revert TooLittle();
        uint256 before = cost(m.b, m.qA, m.qB);
        if (side == 1) m.qA -= amount;
        else m.qB -= amount;
        uint256 afterCost = cost(m.b, m.qA, m.qB);
        uint256 back = before > afterCost + 1 ? before - afterCost - 1 : 0;
        shares[id][msg.sender][side] -= amount;
        m.collateral -= back;
        emit Traded(id, msg.sender, side, -int256(amount), -int256(back), priceA(id));
        _pay(msg.sender, back);
    }

    function redeemable(uint256 id, address who) public view returns (uint256) {
        uint8 r = duel.resultOf(id);
        if (r == 0) return 0;
        uint256 a = shares[id][who][1];
        uint256 b = shares[id][who][2];
        if (r == 1) return a;
        if (r == 2) return b;
        return (a + b) / 2;
    }

    function redeem(uint256 id) external {
        if (duel.resultOf(id) == 0) revert NotFinished();
        uint256 amount = redeemable(id, msg.sender);
        if (amount == 0) revert TooLittle();
        delete shares[id][msg.sender];
        markets[id].paidOut += amount;
        emit Redeemed(id, msg.sender, amount);
        _pay(msg.sender, amount);
    }

    // what the house gets back once the match is over: collateral minus everything the shares can claim
    function houseSettle(uint256 id) external onlyOwner {
        Market storage m = markets[id];
        uint8 r = duel.resultOf(id);
        if (r == 0) revert NotFinished();
        if (m.b == 0 || m.settledHouse) revert NoMarket();
        uint256 owed = r == 1 ? m.qA : r == 2 ? m.qB : (m.qA + m.qB) / 2;
        m.settledHouse = true;
        uint256 left = m.collateral - owed;
        emit HouseSettled(id, left);
        _pay(msg.sender, left);
    }

    function _live(uint256 id, uint8 side) internal view returns (Market storage m) {
        if (side != 1 && side != 2) revert BadSide();
        m = markets[id];
        if (m.b == 0) revert NoMarket();
        if (!duel.bettingOpen(id)) revert Closed();
    }

    function _pay(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "pay failed");
    }
}
