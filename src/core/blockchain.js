/**
 * Blockchain Interaction Manager
 * Handles all direct blockchain interactions
 */
const { ethers } = require('ethers');
const constants = require('../utils/constants');
const logger = require('../utils/logger');
const ProxyManager = require('./proxy');

class Blockchain {
  /**
   * Create a new blockchain interaction manager
   * @param {string} privateKey Private key for the wallet
   * @param {Object} config Configuration object
   * @param {number|null} walletNum Optional wallet number for logging
   */
  constructor(privateKey, config = {}, walletNum = null) {
    this.config = config;
    this.walletNum = walletNum;
    this.logger = walletNum !== null ? 
      logger.getInstance(walletNum) : 
      logger.getInstance();
    
    // Initialize provider
    this.rpcUrl = constants.NETWORK.RPC_URL;
    this.provider = this._createProvider(this.rpcUrl);
    
    // Initialize wallet if private key provided
    if (privateKey) {
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.address = this.wallet.address;
      this.privateKey = privateKey;
    }
    
    // Track nonce values for this session
    this.currentNonce = null;
    
    // Log proxy status if enabled
    const proxyManager = ProxyManager.getInstance();
    if (proxyManager.isEnabled() && proxyManager.currentProxy) {
      this.logger.info(`Using proxy for blockchain connections: ${proxyManager.currentProxy}`);
    }
  }
  
  /**
   * Create a JSON-RPC provider with proxy support
   * @param {string} rpcUrl RPC endpoint URL
   * @returns {ethers.JsonRpcProvider} Provider instance
   * @private
   */
  _createProvider(rpcUrl) {
    const proxyManager = ProxyManager.getInstance();
    let fetchFn = undefined;
    const proxyHeaders = proxyManager.getHeaders();
    
    if (Object.keys(proxyHeaders).length > 0) {
      // Create a custom fetch function that adds proxy headers
      fetchFn = async (url, json) => {
        const response = await fetch(url, {
          method: 'POST',
          body: json,
          headers: {
            'Content-Type': 'application/json',
            ...proxyHeaders
          }
        });
        return response;
      };
    }
    
    // Create provider with custom fetch function if available
    return new ethers.JsonRpcProvider(rpcUrl, undefined, { 
      fetchFunc: fetchFn 
    });
  }
  
  /**
   * Set the wallet number for this instance
   * @param {number|null} num Wallet number
   */
  setWalletNum(num) {
    this.walletNum = num;
    this.logger = logger.getInstance(num);
  }
  
  /**
   * Change the proxy used for connections
   * @returns {string|null} The new proxy or null if unavailable
   */
  changeProxy() {
    const proxyManager = ProxyManager.getInstance();
    const newProxy = proxyManager.selectNextProxy();
    
    if (newProxy) {
      // Re-initialize provider with new proxy
      this.provider = this._createProvider(this.rpcUrl);
      
      // Reinitialize wallet with new provider
      if (this.privateKey) {
        this.wallet = new ethers.Wallet(this.privateKey, this.provider);
        this.address = this.wallet.address;
      }
      
      this.logger.info(`Changed proxy to: ${newProxy}`);
    }
    
    return newProxy;
  }
  
  /**
   * Get current nonce for the wallet
   * @returns {Promise<number>} Current nonce value
   */
  async getNonce() {
    if (this.currentNonce === null) {
      this.currentNonce = await this.provider.getTransactionCount(this.address);
      this.logger.info(`Initial nonce from network: ${this.currentNonce}`);
    } else {
      this.logger.info(`Using tracked nonce: ${this.currentNonce}`);
    }
    return this.currentNonce;
  }
  
  /**
   * Increment the nonce counter
   */
  incrementNonce() {
    if (this.currentNonce !== null) {
      this.currentNonce++;
      this.logger.info(`Incremented nonce to: ${this.currentNonce}`);
    }
  }
  
  /**
   * Reset the nonce counter (forces refresh on next use)
   */
  resetNonce() {
    this.currentNonce = null;
  }
  
  /**
   * Get current gas price with multiplier and retry logic
   * @param {number} retryCount Current retry attempt
   * @returns {Promise<BigInt>} Gas price in wei
   */
  async getGasPrice(retryCount = 0) {
    try {
      // Get current gas price from network
      const feeData = await this.provider.getFeeData();
      const networkGasPrice = feeData.gasPrice;
      
      // Apply configured multiplier
      let multiplier = (this.config.get && this.config.get('general.gas_price_multiplier')) || 
                       constants.GAS.PRICE_MULTIPLIER;
      
      // Apply additional multiplier on retries
      if (retryCount > 0) {
        const retryMultiplier = Math.pow(constants.GAS.RETRY_INCREASE, retryCount);
        multiplier *= retryMultiplier;
        this.logger.info(`Applying retry multiplier: ${retryMultiplier.toFixed(2)}x (total: ${multiplier.toFixed(2)}x)`);
      }
      
      // Calculate adjusted gas price
      const adjustedGasPrice = BigInt(Math.floor(Number(networkGasPrice) * multiplier));
      
      // Convert to gwei for display
      const gweiPrice = ethers.formatUnits(adjustedGasPrice, 'gwei');
      this.logger.info(`Gas price: ${ethers.formatUnits(networkGasPrice, 'gwei')} gwei, using: ${gweiPrice} gwei (${multiplier.toFixed(2)}x)`);
      
      // Enforce min/max gas price
      const minGasPrice = BigInt(ethers.parseUnits(constants.GAS.MIN_GWEI.toString(), 'gwei'));
      const maxGasPrice = BigInt(ethers.parseUnits(constants.GAS.MAX_GWEI.toString(), 'gwei'));
      
      let finalGasPrice = adjustedGasPrice;
      if (adjustedGasPrice < minGasPrice) {
        finalGasPrice = minGasPrice;
        this.logger.warn(`Gas price below minimum, using: ${constants.GAS.MIN_GWEI} gwei`);
      } else if (adjustedGasPrice > maxGasPrice) {
        finalGasPrice = maxGasPrice;
        this.logger.warn(`Gas price above maximum, using: ${constants.GAS.MAX_GWEI} gwei`);
      }
      
      return finalGasPrice;
    } catch (error) {
      this.logger.warn(`Error getting gas price: ${error.message}`);
      
      const proxyManager = ProxyManager.getInstance();
      
      // Handle proxy errors
      if (proxyManager.isEnabled() && error.message.includes('proxy')) {
        this.logger.warn('Proxy error detected, trying to change proxy...');
        this.changeProxy();
        if (retryCount < 3) {
          return this.getGasPrice(retryCount + 1);
        }
      }
      
      // Fallback to minimum gas price
      const fallbackGasPrice = ethers.parseUnits(constants.GAS.MIN_GWEI.toString(), 'gwei');
      this.logger.warn(`Using fallback gas price: ${constants.GAS.MIN_GWEI} gwei`);
      
      return fallbackGasPrice;
    }
  }
  
  /**
   * Estimate gas for a transaction
   * @param {Object} txObject Transaction object
   * @returns {Promise<BigInt>} Estimated gas limit with safety buffer
   */
  async estimateGas(txObject) {
    try {
      // Estimate gas from the network
      const estimatedGas = await this.provider.estimateGas(txObject);
      
      // Add 20% safety buffer
      const gasWithBuffer = BigInt(Math.floor(Number(estimatedGas) * 1.2));
      
      this.logger.info(`Estimated gas: ${estimatedGas.toString()}, with buffer: ${gasWithBuffer.toString()}`);
      
      return gasWithBuffer;
    } catch (error) {
      this.logger.warn(`Gas estimation failed: ${error.message}`);
      
      const proxyManager = ProxyManager.getInstance();
      
      // Handle proxy errors
      if (proxyManager.isEnabled() && error.message.includes('proxy')) {
        this.logger.warn('Proxy error detected, trying to change proxy...');
        this.changeProxy();
        if (txObject.retry === undefined || txObject.retry < 3) {
          const newTxObject = { ...txObject, retry: (txObject.retry || 0) + 1 };
          return this.estimateGas(newTxObject);
        }
      }
      
      // Use default gas limit
      const defaultGas = constants.GAS.DEFAULT_GAS;
      this.logger.warn(`Using default gas: ${defaultGas}`);
      return BigInt(defaultGas);
    }
  }
  
  /**
   * Send a transaction to the blockchain
   * @param {Object} txObject Transaction object
   * @param {string} methodName Method name for logging
   * @returns {Promise<Object>} Transaction result
   */
  async sendTransaction(txObject, methodName = "transaction") {
    try {
      const chainId = constants.NETWORK.CHAIN_ID;
      const explorerUrl = constants.NETWORK.EXPLORER_URL;
      
      // Get nonce and gas price
      const nonce = await this.getNonce();
      const gasPrice = await this.getGasPrice();
      
      // Create transaction template
      const txTemplate = {
        from: this.address,
        ...txObject,
        nonce: nonce,
        chainId: chainId
      };
      
      // Estimate gas if not provided
      if (!txTemplate.gasLimit) {
        txTemplate.gasLimit = await this.estimateGas(txTemplate);
      }
      
      // Set gas price if not provided
      if (!txTemplate.gasPrice) {
        txTemplate.gasPrice = gasPrice;
      }
      
      // Increment nonce before sending
      this.incrementNonce();
      
      // Send transaction
      const tx = await this.wallet.sendTransaction(txTemplate);
      const receipt = await tx.wait();
      
      this.logger.success(`${methodName} transaction successful`);
      
      return {
        txHash: receipt.hash,
        receipt,
        success: true
      };
    } catch (error) {
      // Extract clean error message
      let cleanErrorMessage = '';
      
      if (error.code) {
        // Use error code if available
        cleanErrorMessage = error.code;
        
        // Add specific details for common errors
        if (error.code === 'INSUFFICIENT_FUNDS') {
          cleanErrorMessage = 'Insufficient funds for transaction';
        } else if (error.code === 'NONCE_EXPIRED') {
          cleanErrorMessage = 'Nonce has already been used';
        } else if (error.code === 'REPLACEMENT_UNDERPRICED') {
          cleanErrorMessage = 'Gas price too low to replace pending transaction';
        } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
          cleanErrorMessage = 'Cannot estimate gas for transaction';
        } else {
          // Add additional error information when helpful
          if (error.reason) {
            cleanErrorMessage += `: ${error.reason}`;
          }
        }
      } else {
        // Use message if no code is available
        cleanErrorMessage = error.message;
        
        // Try to extract the most relevant part
        if (error.message.includes(':')) {
          cleanErrorMessage = error.message.split(':')[0].trim();
        }
      }
      
      this.logger.error(`Error in ${methodName}: ${cleanErrorMessage}`);
      
      const proxyManager = ProxyManager.getInstance();
      
      // Handle proxy errors
      if (proxyManager.isEnabled() &&
          (error.message.includes('proxy') || 
           error.message.includes('ETIMEDOUT') || 
           error.message.includes('ECONNREFUSED') || 
           error.message.includes('ECONNRESET'))) {
        
        this.logger.warn('Possible proxy error detected, trying to change proxy...');
        this.changeProxy();
        
        // Retry with new proxy
        if (txObject.retryCount === undefined || txObject.retryCount < 3) {
          this.logger.info(`Retrying transaction with new proxy (attempt ${(txObject.retryCount || 0) + 1}/3)...`);
          const newTxObject = { ...txObject, retryCount: (txObject.retryCount || 0) + 1 };
          return this.sendTransaction(newTxObject, methodName);
        }
      }
      
      return {
        success: false,
        error: cleanErrorMessage,
        code: error.code || 'UNKNOWN_ERROR',
        details: error
      };
    }
  }
  
  /**
   * Get wallet balance
   * @returns {Promise<Object>} Balance information
   */
  async getBalance() {
    try {
      const currency = constants.NETWORK.CURRENCY_SYMBOL;
      
      const balance = await this.provider.getBalance(this.address);
      const balanceInEth = ethers.formatEther(balance);
      
      this.logger.info(`Balance: ${balanceInEth} ${currency}`);
      
      return { 
        balance, 
        balanceInEth,
        currency
      };
    } catch (error) {
      this.logger.error(`Error getting balance: ${error.message}`);
      
      const proxyManager = ProxyManager.getInstance();
      
      // Handle proxy errors
      if (proxyManager.isEnabled() && 
          (error.message.includes('proxy') || 
           error.message.includes('ETIMEDOUT') || 
           error.message.includes('ECONNREFUSED') || 
           error.message.includes('ECONNRESET'))) {
        
        this.logger.warn('Proxy error detected, trying to change proxy...');
        if (this.changeProxy()) {
          this.logger.info('Retrying getBalance with new proxy...');
          return this.getBalance();
        }
      }
      
      return {
        balance: BigInt(0),
        balanceInEth: '0',
        currency: constants.NETWORK.CURRENCY_SYMBOL,
        error: error.message
      };
    }
  }
  
  /**
   * Get proxy information
   * @returns {Object} Proxy status information
   */
  getProxyInfo() {
    const proxyManager = ProxyManager.getInstance();
    
    if (!proxyManager.isEnabled()) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      current: proxyManager.currentProxy,
      type: proxyManager.getType()
    };
  }
}

module.exports = Blockchain;