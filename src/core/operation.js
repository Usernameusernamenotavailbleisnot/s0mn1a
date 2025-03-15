/**
 * Base Operation Class
 * All blockchain operations extend this class
 */
const Blockchain = require('./blockchain');
const logger = require('../utils/logger');
const { randomDelay } = require('../utils/delay');

class Operation {
  /**
   * Create a new operation
   * @param {string|Object} blockchainOrPrivateKey Private key or Blockchain instance
   * @param {Object} config Configuration object
   * @param {string} operationName Name of the operation
   */
  constructor(blockchainOrPrivateKey, config = {}, operationName = null) {
    this.operationName = operationName;
    
    // Initialize blockchain instance
    if (blockchainOrPrivateKey && typeof blockchainOrPrivateKey === 'object' && 
        blockchainOrPrivateKey.constructor.name === 'Blockchain') {
      this.blockchain = blockchainOrPrivateKey;
    } else if (blockchainOrPrivateKey && typeof blockchainOrPrivateKey === 'string') {
      this.blockchain = new Blockchain(blockchainOrPrivateKey, config, null);
    } else {
      this.blockchain = null;
    }
    
    this.walletNum = this.blockchain ? this.blockchain.walletNum : null;
    this.config = config;
    this.logger = this.walletNum !== null ? 
      logger.getInstance(this.walletNum) : 
      logger.getInstance();
  }
  
  /**
   * Set wallet number for this operation
   * @param {number} num Wallet number
   */
  setWalletNum(num) {
    this.walletNum = num;
    if (this.blockchain) this.blockchain.setWalletNum(num);
    this.logger = logger.getInstance(num);
  }
  
  /**
   * Check if this operation is enabled in configuration
   * @returns {boolean}
   */
  isEnabled() {
    if (!this.operationName) return true;
    
    return this.config.isEnabled ? 
      this.config.isEnabled(this.operationName) : 
      this.config.get(`operations.${this.operationName}.enabled`, false) === true;
  }
  
  /**
   * Get delay configuration for this operation
   * @returns {Object} Delay settings with min_seconds and max_seconds
   */
  getDelayConfig() {
    return this.config.getDelayConfig ? 
      this.config.getDelayConfig() : 
      (this.config.general && this.config.general.delay) || 
      { min_seconds: 5, max_seconds: 30 };
  }
  
  /**
   * Add a random delay before next action
   * @param {string} message Message to display during delay
   * @returns {Promise<boolean>} Success status
   */
  async addDelay(message) {
    return await randomDelay(this.getDelayConfig(), this.walletNum, message);
  }
  
  /**
   * Main execution method
   * @returns {Promise<boolean>} Success status
   */
  async execute() {
    if (!this.isEnabled()) {
      this.logger.warn(`${this.operationName} operations disabled in config`);
      return true; // Return success to not interrupt the flow
    }
    
    this.logger.header(`Starting ${this.operationName} operations...`);
    
    try {
      // Reset blockchain manager nonce if available
      if (this.blockchain) this.blockchain.resetNonce();
      
      // Execute implementation-specific operations
      const result = await this.executeOperations();
      
      if (result) {
        this.logger.success(`${this.operationName} operations completed successfully!`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error in ${this.operationName} operations: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Implementation-specific operations (must be overridden by subclasses)
   * @returns {Promise<boolean>} Success status
   */
  async executeOperations() {
    throw new Error('executeOperations must be implemented by subclass');
  }
}

module.exports = Operation;