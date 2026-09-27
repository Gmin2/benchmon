// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "solady/auth/Ownable.sol";
import {IStatsFeed} from "./interfaces/IStatsFeed.sol";
import {IReceiver, IERC165} from "./interfaces/IReceiver.sol";
import {ICardStats} from "./interfaces/ICardStats.sol";

// takes benchmark stats from a chainlink cre workflow and writes them into CardStats. only the forwarder it
// trusts can deliver a report. report = abi.encode(uint256[] ids, uint8[6][] stats)
contract StatsFeed is IStatsFeed, Ownable {
    ICardStats public immutable cards;
    address public forwarder;
    uint256 public reports;

    constructor(ICardStats _cards, address _forwarder) {
        cards = _cards;
        forwarder = _forwarder;
        _initializeOwner(msg.sender);
    }

    // the simulation forwarder for the demo, the production one once the workflow is deployed to a don
    function setForwarder(address f) external onlyOwner {
        forwarder = f;
        emit ForwarderSet(f);
    }

    function onReport(bytes calldata, bytes calldata report) external {
        if (msg.sender != forwarder) revert NotForwarder();
        (uint256[] memory ids, uint8[6][] memory stats) = abi.decode(report, (uint256[], uint8[6][]));
        if (ids.length == 0 || ids.length != stats.length) revert BadReport();
        for (uint256 i; i < ids.length; i++) {
            cards.setCard(ids[i], "", stats[i]);
        }
        emit ReportApplied(++reports, ids.length);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
