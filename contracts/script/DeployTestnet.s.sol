// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CardStats} from "../src/CardStats.sol";
import {Duel} from "../src/Duel.sol";
import {Backing} from "../src/Backing.sol";
import {MatchMarket} from "../src/MatchMarket.sol";
import {StatsFeed} from "../src/StatsFeed.sol";

// monad testnet: the game contracts, with the deployer as judge and house for now.
// the stats feed trusts chainlink's simulation forwarder on 10143.
contract DeployTestnet is Script {
    address constant MOCK_FORWARDER = 0xB9F79d863261869B234c481D1f9A7af84AeAd192;

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address me = vm.addr(key);
        vm.startBroadcast(key);
        CardStats cards = new CardStats();
        Duel duel = new Duel(cards, me);
        Backing backing = new Backing(duel);
        MatchMarket market = new MatchMarket(duel);
        StatsFeed feed = new StatsFeed(cards, MOCK_FORWARDER);
        cards.setUpdater(address(feed));
        vm.stopBroadcast();
        console.log("cards", address(cards));
        console.log("duel", address(duel));
        console.log("backing", address(backing));
        console.log("market", address(market));
        console.log("feed", address(feed));
    }
}
