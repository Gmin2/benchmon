// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IReceiver} from "./IReceiver.sol";
import {ICardStats} from "./ICardStats.sol";

/// writes benchmark stats delivered by chainlink cre into the card stats
interface IStatsFeed is IReceiver {
    event ForwarderSet(address forwarder);
    event WorkflowSet(address owner, bytes32 id);
    event ReportApplied(uint256 indexed n, uint256 cards);

    error NotForwarder();
    error BadReport();
    error WrongWorkflow();

    function cards() external view returns (ICardStats);
    function forwarder() external view returns (address);
    function reports() external view returns (uint256);
    function expectedWorkflowOwner() external view returns (address);
    function expectedWorkflowId() external view returns (bytes32);
    function setForwarder(address f) external;
    function setWorkflow(address owner, bytes32 id) external;
}
