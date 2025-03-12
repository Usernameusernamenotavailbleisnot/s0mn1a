// Blockchain interactions manager
const { ethers } = require('ethers');
const constants = require('../utils/constants');
const logger = require('../utils/logger');
const proxyManager = require('./proxy');

class Blockchain {
  constructor(privateKey, config = {}, walletNum = null) {
    // Store configuration
    this.config = config;
    this.walletNum = walletNum;
    this.logger = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    
    // Initialize providers
    this.rpcUrl = constants.NETWORK.RPC_URL;
    this.provider = this.createProvider(this.rpcUrl);
    
    // Setup wallet
    if (privateKey) {
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.address = this.wallet.address;
      this.privateKey = privateKey;
    }
    
    // Track nonce values
    this.currentNonce = null;
    
    // Log proxy status
    if (proxyManager.isEnabled() && proxyManager.currentProxy) {
      this.logger.info(`Using proxy for blockchain connections: ${proxyManager.currentProxy}`);
    }
  }
  
  createProvider(rpcUrl) {
    // Create JSON-RPC fetch function with proxy setup
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
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { fetchFunc: fetchFn });
    return provider;
  }
  
  setWalletNum(num) {
    this.walletNum = num;
    this.logger = logger.getInstance(num);
  }
  
  changeProxy() {
    const newProxy = proxyManager.selectNextProxy();
    
    if (newProxy) {
      // Re-initialize providers
      this.provider = this.createProvider(this.rpcUrl);
      
      // Reinitialize wallets
      if (this.privateKey) {
        this.wallet = new ethers.Wallet(this.privateKey, this.provider);
        this.address = this.wallet.address;
      }
      
      this.logger.info(`Changed proxy to: ${newProxy}`);
    }
    
    return newProxy;
  }
  
  async getNonce() {
    if (this.currentNonce === null) {
      this.currentNonce = await this.provider.getTransactionCount(this.address);
      this.logger.info(`Initial nonce from network: ${this.currentNonce}`);
    } else {
      this.logger.info(`Using tracked nonce: ${this.currentNonce}`);
    }
    return this.currentNonce;
  }
  
  incrementNonce() {
    if (this.currentNonce !== null) {
      this.currentNonce++;
      this.logger.info(`Incremented nonce to: ${this.currentNonce}`);
    }
  }
  
  async getGasPrice(retryCount = 0) {
    try {
      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const networkGasPrice = feeData.gasPrice;
      
      // Apply multiplier
      let multiplier = (this.config.get && this.config.get('general.gas_price_multiplier')) || constants.GAS.PRICE_MULTIPLIER;
      
      // Apply retry multiplier
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
  
  async estimateGas(txObject) {
    try {
      // Estimate gas
      const estimatedGas = await this.provider.estimateGas(txObject);
      
      // Add safety buffer
      const gasWithBuffer = BigInt(Math.floor(Number(estimatedGas) * 1.2));
      
      this.logger.info(`Estimated gas: ${estimatedGas.toString()}, with buffer: ${gasWithBuffer.toString()}`);
      
      return gasWithBuffer;
    } catch (error) {
      this.logger.warn(`Gas estimation failed: ${error.message}`);
      
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
      
      // Handle proxy errors
      if (proxyManager.isEnabled() &&
          (error.message.includes('proxy') || error.message.includes('ETIMEDOUT') || 
          error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET'))) {
        
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
      
      // Handle proxy errors
      if (proxyManager.isEnabled() && 
          (error.message.includes('proxy') || error.message.includes('ETIMEDOUT') || 
           error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET'))) {
        
        this.logger.warn('Proxy error detected, trying to change proxy...');
        if (this.changeProxy()) {
          this.logger.info('Retrying getBalance with new proxy...');
          return this.getBalance();
        }
      }
      
      return {
        balance: '0',
        balanceInEth: '0',
        currency: constants.NETWORK.CURRENCY_SYMBOL,
        error: error.message
      };
    }
  }
  
  resetNonce() {
    this.currentNonce = null;
  }
  
  getProxyInfo() {
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