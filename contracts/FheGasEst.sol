// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract FheGasEst is SepoliaConfig {
    struct OperationCost {
        string operationName;
        uint256 baseCost;
        uint256 perByteCost;
    }

    struct ContractAnalysis {
        string contractName;
        uint256 totalFheOps;
        uint256 estimatedGas;
        string[] optimizationSuggestions;
    }

    mapping(string => OperationCost) public operationCosts;
    mapping(address => ContractAnalysis) public contractAnalyses;
    
    address[] public analyzedContracts;
    uint256 public analysisCount;

    event OperationCostUpdated(string operation, uint256 baseCost, uint256 perByteCost);
    event ContractAnalyzed(address indexed contractAddress, uint256 estimatedGas);
    event OptimizationSuggested(address indexed contractAddress, string suggestion);

    constructor() {
        // Initialize default operation costs
        operationCosts["FHE.add"] = OperationCost("FHE.add", 5000, 10);
        operationCosts["FHE.sub"] = OperationCost("FHE.sub", 5000, 10);
        operationCosts["FHE.mul"] = OperationCost("FHE.mul", 15000, 20);
        operationCosts["FHE.div"] = OperationCost("FHE.div", 20000, 25);
        operationCosts["FHE.gt"] = OperationCost("FHE.gt", 8000, 15);
        operationCosts["FHE.lt"] = OperationCost("FHE.lt", 8000, 15);
        operationCosts["FHE.eq"] = OperationCost("FHE.eq", 7000, 12);
        operationCosts["FHE.ne"] = OperationCost("FHE.ne", 7000, 12);
        operationCosts["FHE.and"] = OperationCost("FHE.and", 6000, 10);
        operationCosts["FHE.or"] = OperationCost("FHE.or", 6000, 10);
        operationCosts["FHE.not"] = OperationCost("FHE.not", 4000, 8);
        operationCosts["FHE.cast"] = OperationCost("FHE.cast", 3000, 5);
    }

    function updateOperationCost(
        string memory operation,
        uint256 baseCost,
        uint256 perByteCost
    ) public {
        operationCosts[operation] = OperationCost(operation, baseCost, perByteCost);
        emit OperationCostUpdated(operation, baseCost, perByteCost);
    }

    function analyzeContract(
        address contractAddress,
        string memory contractName,
        string[] memory operations,
        uint256[] memory operationCounts,
        uint256 avgDataSize
    ) public returns (ContractAnalysis memory) {
        require(operations.length == operationCounts.length, "Invalid input lengths");

        uint256 totalGas = 0;
        uint256 totalOps = 0;
        string[] memory suggestions;

        for (uint256 i = 0; i < operations.length; i++) {
            OperationCost memory cost = operationCosts[operations[i]];
            require(cost.baseCost > 0, "Unknown operation");

            uint256 opGas = cost.baseCost + (cost.perByteCost * avgDataSize);
            totalGas += opGas * operationCounts[i];
            totalOps += operationCounts[i];

            // Generate optimization suggestions
            if (cost.baseCost > 10000 && operationCounts[i] > 5) {
                string memory suggestion = string(abi.encodePacked(
                    "Consider reducing calls to ", operations[i], 
                    " (", Strings.toString(operationCounts[i]), " calls)"
                ));
                suggestions = appendString(suggestions, suggestion);
                emit OptimizationSuggested(contractAddress, suggestion);
            }
        }

        ContractAnalysis memory analysis = ContractAnalysis({
            contractName: contractName,
            totalFheOps: totalOps,
            estimatedGas: totalGas,
            optimizationSuggestions: suggestions
        });

        contractAnalyses[contractAddress] = analysis;
        analyzedContracts.push(contractAddress);
        analysisCount++;

        emit ContractAnalyzed(contractAddress, totalGas);
        return analysis;
    }

    function getAnalysis(address contractAddress) public view returns (ContractAnalysis memory) {
        return contractAnalyses[contractAddress];
    }

    function estimateSingleOperation(
        string memory operation,
        uint256 dataSize
    ) public view returns (uint256) {
        OperationCost memory cost = operationCosts[operation];
        require(cost.baseCost > 0, "Unknown operation");
        return cost.baseCost + (cost.perByteCost * dataSize);
    }

    function getAllAnalyzedContracts() public view returns (address[] memory) {
        return analyzedContracts;
    }

    function appendString(string[] memory array, string memory element) private pure returns (string[] memory) {
        string[] memory newArray = new string[](array.length + 1);
        for (uint256 i = 0; i < array.length; i++) {
            newArray[i] = array[i];
        }
        newArray[array.length] = element;
        return newArray;
    }
}