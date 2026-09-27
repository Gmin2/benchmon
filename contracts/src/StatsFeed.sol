// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CardStats} from "./CardStats.sol";

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// chainlink cre receiver interface: the keystone forwarder calls onReport after the don signs a report
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

// takes benchmark stats from a chainlink cre workflow and writes them into CardStats. only the forwarder it
// trusts can deliver a report. report = abi.encode(uint256[] ids, uint8[6][] stats)
contract StatsFeed is IReceiver {
    CardStats public immutable cards;
    address public owner;
    address public forwarder;
    uint256 public reports;

    event ForwarderSet(address forwarder);
    event ReportApplied(uint256 indexed n, uint256 cards);

    error NotForwarder();
    error NotOwner();
    error BadReport();

    constructor(CardStats _cards, address _forwarder) {
        cards = _cards;
        owner = msg.sender;
        forwarder = _forwarder;
    }

    // the simulation forwarder for the demo, the production one once the workflow is deployed to a don
    function setForwarder(address f) external {
        if (msg.sender != owner) revert NotOwner();
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
