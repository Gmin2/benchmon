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
    // the forwarder delivers reports from any workflow that targets this contract, so we also check who wrote
    // the workflow (and optionally which one). zero means not checked.
    address public expectedWorkflowOwner;
    bytes32 public expectedWorkflowId;

    constructor(ICardStats _cards, address _forwarder) {
        cards = _cards;
        if (_forwarder == address(0)) revert NotForwarder();
        forwarder = _forwarder;
        _initializeOwner(msg.sender);
    }

    // the simulation forwarder for the demo, the production one once the workflow is deployed to a don
    function setForwarder(address f) external onlyOwner {
        if (f == address(0)) revert NotForwarder();
        forwarder = f;
        emit ForwarderSet(f);
    }

    function setWorkflow(address wfOwner, bytes32 id) external onlyOwner {
        expectedWorkflowOwner = wfOwner;
        expectedWorkflowId = id;
        emit WorkflowSet(wfOwner, id);
    }

    // metadata from the forwarder: workflow id (32 bytes), workflow name (10), workflow owner (20), then 2 more
    function onReport(bytes calldata metadata, bytes calldata report) external {
        if (msg.sender != forwarder) revert NotForwarder();
        if (expectedWorkflowOwner != address(0) || expectedWorkflowId != bytes32(0)) {
            if (metadata.length < 62) revert WrongWorkflow();
            if (expectedWorkflowId != bytes32(0) && bytes32(metadata[0:32]) != expectedWorkflowId) {
                revert WrongWorkflow();
            }
            if (expectedWorkflowOwner != address(0) && address(bytes20(metadata[42:62])) != expectedWorkflowOwner) {
                revert WrongWorkflow();
            }
        }
        (uint256[] memory ids, uint8[6][] memory stats) = abi.decode(report, (uint256[], uint8[6][]));
        if (ids.length == 0 || ids.length != stats.length) revert BadReport();
        emit ReportApplied(++reports, ids.length);
        for (uint256 i; i < ids.length; i++) {
            cards.setCard(ids[i], "", stats[i]);
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
