// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ICardStats} from "../src/interfaces/ICardStats.sol";
import {Duel} from "../src/Duel.sol";
import {Backing} from "../src/Backing.sol";
import {MatchMarket} from "../src/MatchMarket.sol";

// redeploys the game on top of the existing CardStats, so the real stats written through chainlink stay.
// usage: CARDS=0x... forge script script/DeployGame.s.sol --rpc-url $RPC_URL --broadcast
contract DeployGame is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address me = vm.addr(key);
        ICardStats cards = ICardStats(vm.envAddress("CARDS"));
        vm.startBroadcast(key);
        Duel duel = new Duel(cards, me);
        duel.setDeckCap(1600);
        Backing backing = new Backing(duel);
        MatchMarket market = new MatchMarket(duel);
        vm.stopBroadcast();
        console.log("duel", address(duel));
        console.log("backing", address(backing));
        console.log("market", address(market));
    }
}
