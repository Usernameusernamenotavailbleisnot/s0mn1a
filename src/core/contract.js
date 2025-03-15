/**
 * Smart Contract Manager
 * Handles smart contract compilation, deployment, and interaction
 */
const solc = require('solc');
const { ethers } = require('ethers');
const logger = require('../utils/logger');
const constants = require('../utils/constants');
const { randomDelay } = require('../utils/delay');

class Contract {
  /**
   * Create a new contract manager
   * @param {Object} blockchain Blockchain instance
   * @param {Object} config Configuration object
   */
  constructor(blockchain, config = {}) {
    this.blockchain = blockchain;
    this.config = config;
    this.walletNum = blockchain.walletNum;
    this.logger = this.walletNum !== null ? 
      logger.getInstance(this.walletNum) : 
      logger.getInstance();
    
    // Cache for compiled contracts
    this.compiledContracts = new Map();
  }
  
  /**
   * Get delay configuration for this instance
   * @returns {Object} Delay settings with min_seconds and max_seconds
   */
  getDelayConfig() {
    return this.config.getDelayConfig ? 
      this.config.getDelayConfig() : 
      (this.config.general && this.config.general.delay) ? 
        this.config.general.delay : 
        (this.config.delay) ? 
          this.config.delay : 
          { min_seconds: 5, max_seconds: 30 };
  }
  
  /**
   * Add random delay between operations
   * @param {string} message Operation message for logging
   * @returns {Promise<boolean>} Success status
   */
  async addDelay(message) {
    return await randomDelay(this.getDelayConfig(), this.walletNum, message);
  }
  
  /**
   * Compile a smart contract
   * @param {string} contractName Contract name
   * @param {string} contractSource Solidity source code
   * @param {string|null} solFileName Optional filename for compiler
   * @returns {Promise<Object>} Compiled contract with ABI and bytecode
   */
  async compileContract(contractName, contractSource, solFileName = null) {
    // Check cache first
    const cacheKey = `${contractName}_${contractSource.length}`;
    if (this.compiledContracts.has(cacheKey)) {
      this.logger.info(`Using cached compilation for ${contractName} contract`);
      return this.compiledContracts.get(cacheKey);
    }
    
    try {
      this.logger.info(`Compiling ${contractName} contract...`);
      
      // Use provided file name or default based on contract name
      const fileName = solFileName || `${contractName}.sol`;
      
      // Setup compiler input
      const input = {
        language: 'Solidity',
        sources: {
          [fileName]: {
            content: contractSource
          }
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['abi', 'evm.bytecode']
            }
          },
          optimizer: {
            enabled: true,
            runs: 200
          },
          evmVersion: 'paris' // Use paris EVM version (before Shanghai which introduced PUSH0)
        }
      };
      
      // Compile the contract
      const output = JSON.parse(solc.compile(JSON.stringify(input)));
      
      // Check for errors
      if (output.errors) {
        const errors = output.errors.filter(error => error.severity === 'error');
        if (errors.length > 0) {
          throw new Error(`Compilation errors: ${errors.map(e => e.message).join(', ')}`);
        }
      }
      
      // Extract the contract
      const contract = output.contracts[fileName][contractName];
      
      const compiledContract = {
        abi: contract.abi,
        bytecode: contract.evm.bytecode.object
      };
      
      // Cache the compiled contract
      this.compiledContracts.set(cacheKey, compiledContract);
      
      this.logger.success(`${contractName} contract compiled successfully!`);
      return compiledContract;
    } catch (error) {
      this.logger.error(`Failed to compile ${contractName} contract: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Deploy a smart contract
   * @param {Object} compiledContract Compiled contract object
   * @param {Array} constructorArgs Constructor arguments
   * @param {string} methodName Contract name for logging
   * @returns {Promise<Object>} Deployed contract info
   */
  async deployContract(compiledContract, constructorArgs = [], methodName = "contract") {
    try {
      this.logger.info(`Deploying ${methodName} contract...`);
      
      // Add random delay before deployment
      await this.addDelay(`${methodName} contract deployment`);
      
      // Create deployment transaction
      const factory = new ethers.ContractFactory(
        compiledContract.abi,
        `0x${compiledContract.bytecode}`,
        this.blockchain.wallet
      );
      
      // Deploy the contract
      const contract = await factory.deploy(...constructorArgs);
      await contract.waitForDeployment();
      
      const contractAddress = await contract.getAddress();
      const deployTx = contract.deploymentTransaction();
      
      this.logger.success(`${methodName} contract deployed at: ${contractAddress}`);
      this.logger.success(`View transaction: ${constants.NETWORK.EXPLORER_URL}/tx/${deployTx.hash}`);
      
      return {
        contractAddress,
        abi: compiledContract.abi,
        txHash: deployTx.hash
      };
    } catch (error) {
      this.logger.error(`Error deploying ${methodName} contract: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Call a contract method that modifies state
   * @param {string} contractAddress Contract address
   * @param {Array} abi Contract ABI
   * @param {string} methodName Method to call
   * @param {Array} methodArgs Method arguments
   * @param {string|BigInt} value ETH value to send
   * @returns {Promise<Object>} Transaction result
   */
  async callContractMethod(contractAddress, abi, methodName, methodArgs = [], value = '0') {
    try {
      // Add random delay before interaction
      await this.addDelay(`contract method: ${methodName}`);
      
      // Create contract instance
      const contract = new ethers.Contract(
        contractAddress,
        abi,
        this.blockchain.wallet
      );
      
      // Check if value is already a BigInt or needs conversion
      let valueToSend = value;
      if (typeof value === 'string' && value !== '0') {
        try {
          // Try to parse as BigInt first (in case it's already in wei)
          valueToSend = BigInt(value);
        } catch (e) {
          // If that fails, assume it's in ETH and convert to wei
          try {
            valueToSend = ethers.parseEther(value);
          } catch (err) {
            this.logger.error(`Error converting value to wei: ${err.message}`);
            throw err;
          }
        }
      }
      
      // Send transaction with or without value
      let tx;
      if (value !== '0') {
        tx = await contract[methodName](...methodArgs, { value: valueToSend });
      } else {
        tx = await contract[methodName](...methodArgs);
      }
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      this.logger.success(`Method ${methodName} successful`);
      this.logger.success(`View transaction: ${constants.NETWORK.EXPLORER_URL}/tx/${receipt.hash}`);
      
      return {
        success: true,
        txHash: receipt.hash,
        receipt
      };
    } catch (error) {
      this.logger.error(`Error calling ${methodName}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Call a view method that doesn't modify state
   * @param {string} contractAddress Contract address
   * @param {Array} abi Contract ABI
   * @param {string} methodName Method to call
   * @param {Array} methodArgs Method arguments
   * @returns {Promise<Object>} Call result
   */
  async callViewMethod(contractAddress, abi, methodName, methodArgs = []) {
    try {
      // Create contract instance using provider (read-only)
      const contract = new ethers.Contract(
        contractAddress,
        abi,
        this.blockchain.provider
      );
      
      this.logger.info(`Calling view method: ${methodName}`);
      
      // Call the view method
      const result = await contract[methodName](...methodArgs);
      
      return {
        success: true,
        result
      };
    } catch (error) {
      this.logger.error(`Error calling view method ${methodName}: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = Contract;