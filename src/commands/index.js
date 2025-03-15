/**
 * Operation Registry
 * Manages all blockchain operations and their execution
 */
const logger = require('../utils/logger');
const Blockchain = require('../core/blockchain');
const ProxyManager = require('../core/proxy');

// Import all operation classes
const FaucetOperation = require('./faucet');
const TokenSwapOperation = require('./tokenswap');
const MemCoinOperation = require('./memcoin');
const TransferOperation = require('./transfer');
const ERC20Operation = require('./erc20');
const NFTOperation = require('./nft');

/**
 * Registry for all blockchain operations
 */
class OperationRegistry {
  /**
   * Create a new operation registry
   * @param {string} privateKey Wallet private key
   * @param {Object} config Configuration object
   * @param {number|null} walletNum Wallet number for logging
   */
  constructor(privateKey, config = {}, walletNum = null) {
    this.privateKey = privateKey;
    this.config = config;
    this.walletNum = walletNum;
    this.logger = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    
    // Create blockchain instance for this wallet
    this.blockchain = new Blockchain(privateKey, config, walletNum);
    
    // Initialize proxy manager if needed
    this.proxyManager = ProxyManager.getInstance();
    
    // Load operations
    this._loadOperations();
  }
  
  /**
   * Load all available operations
   * @private
   */
  _loadOperations() {
    // Initialize with shared blockchain instance
    this.operations = [
      { 
        name: "faucet", 
        instance: new FaucetOperation(this.blockchain, this.config) 
      },
      { 
        name: "tokenswap", 
        instance: new TokenSwapOperation(this.blockchain, this.config) 
      },
      { 
        name: "memcoin", 
        instance: new MemCoinOperation(this.blockchain, this.config) 
      },
      { 
        name: "transfer", 
        instance: new TransferOperation(this.blockchain, this.config) 
      },
      { 
        name: "erc20", 
        instance: new ERC20Operation(this.blockchain, this.config) 
      },
      { 
        name: "nft", 
        instance: new NFTOperation(this.blockchain, this.config) 
      }
    ];
    
    // Set wallet number for all operations
    if (this.walletNum !== null) {
      this.operations.forEach(op => op.instance.setWalletNum(this.walletNum));
    }
  }
  
  /**
   * Set wallet number for all operations
   * @param {number} num Wallet number
   */
  setWalletNum(num) {
    this.walletNum = num;
    this.logger = logger.getInstance(num);
    this.blockchain.setWalletNum(num);
    this.operations.forEach(op => op.instance.setWalletNum(num));
  }
  
  /**
   * Get a specific operation by name
   * @param {string} name Operation name
   * @returns {Object|null} Operation instance or null if not found
   */
  getOperation(name) {
    const operation = this.operations.find(op => op.name === name);
    return operation ? operation.instance : null;
  }
  
  /**
   * Rotate proxy if needed based on configuration
   */
  rotateProxyIfNeeded() {
    // Skip if proxy not enabled
    if (!this.proxyManager.isEnabled()) {
      return;
    }
    
    // Skip if rotation not enabled
    if (!this.config.get('proxy.rotation.enabled') || !this.config.get('proxy.rotation.per_operation')) {
      return;
    }
    
    this.logger.info('Rotating proxy for next operation...');
    this.blockchain.changeProxy();
  }
  
  /**
   * Get operations in randomized order according to configuration
   * @returns {Array} Operations in configured order
   */
  getRandomizedOperations() {
    // Get randomization config
    const randomization = this.config.get ? 
      this.config.get('randomization', {}) : 
      (this.config.randomization || {});
    
    // Get operations to run
    const operationsToRun = randomization.operations_to_run || 
      this.operations.map(op => op.name);
    
    // Filter enabled operations
    const filteredOperations = this.operations.filter(op => 
      operationsToRun.includes(op.name) && op.instance.isEnabled());
    
    // Split into fixed and randomizable operations
    const excludedOps = randomization.excluded_operations || [];
    const fixedOps = filteredOperations.filter(op => excludedOps.includes(op.name));
    const randomizableOps = filteredOperations.filter(op => !excludedOps.includes(op.name));
    
    // Always put faucet first if it's enabled
    const faucetOp = filteredOperations.find(op => op.name === 'faucet');
    const nonFaucetOps = filteredOperations.filter(op => op.name !== 'faucet');
    
    // Randomize if enabled
    if (randomization.enable && randomizableOps.length > 1) {
      this._shuffleArray(randomizableOps);
    }
    
    // Return operations in order with faucet first if present
    const orderedOps = [...fixedOps, ...randomizableOps];
    
    if (faucetOp && faucetOp.instance.isEnabled()) {
      return [faucetOp, ...orderedOps.filter(op => op.name !== 'faucet')];
    } else {
      return orderedOps;
    }
  }
  
  /**
   * Shuffle array in-place
   * @param {Array} array Array to shuffle
   * @private
   */
  _shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  
  /**
   * Execute all enabled operations in configured order
   * @returns {Promise<boolean>} Success status
   */
  async executeOperations() {
    const operations = this.getRandomizedOperations();
    
    // Log operations sequence
    this.logger.info(`Operations sequence: ${operations.map(op => op.name).join(' -> ')}`);
    
    let success = true;
    
    // Execute operations in sequence
    for (const operation of operations) {
      try {
        logger.setWalletNum(this.walletNum);
        
        // Rotate proxy if configured
        this.rotateProxyIfNeeded();
        
        const result = await operation.instance.execute();
        if (!result) success = false;
      } catch (error) {
        this.logger.error(`Error in ${operation.name} operation: ${error.message}`);
        success = false;
      }
    }
    
    return success;
  }
}

module.exports = OperationRegistry;