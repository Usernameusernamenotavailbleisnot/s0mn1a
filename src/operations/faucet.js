// Faucet operations for Somnia Network
const axios = require('axios');
const { ethers } = require('ethers');
const constants = require('../utils/constants');
const BaseOperation = require('./base');
const proxyManager = require('../core/proxy');

class Faucet extends BaseOperation {
  constructor(privateKey, configObj = {}) {
    // Default configuration
    const defaultConfig = {
      enabled: true,
      retry: {
        max_attempts: 3,
        delay_ms: 5000
      }
    };
    
    // Initialize base class
    super(privateKey, configObj, 'faucet');
    
    // Set default config
    this.defaultConfig = defaultConfig;
    
    // Store config as configManager for compatibility
    this.configManager = configObj;
  }
  
  // Check if faucet claim is enabled
  isFaucetEnabled() {
    return this.configManager.get ? 
      this.configManager.getBoolean('operations.faucet.enabled', true) :
      (this.config.operations?.faucet?.enabled ?? true);
  }
  
  // Get retry configuration for faucet
  getRetryConfig() {
    return {
      maxAttempts: this.configManager.get ? 
        this.configManager.getNumber('operations.faucet.retry.max_attempts', 3) :
        (this.config.operations?.faucet?.retry?.max_attempts || 3),
      
      delayMs: this.configManager.get ? 
        this.configManager.getNumber('operations.faucet.retry.delay_ms', 5000) :
        (this.config.operations?.faucet?.retry?.delay_ms || 5000)
    };
  }
  
  // Wait for specified milliseconds
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Execute with timeout
  async executeWithTimeout(promise, timeoutMs) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  // Get user agent string
  getUserAgent() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
  }
  
  // Claim from faucet
  async claimFromFaucet() {
    // Check if faucet operations are enabled
    if (!this.isFaucetEnabled()) {
      this.logger.info(`Faucet operations disabled in config`);
      return true; // Return true to not interrupt flow
    }
    
    this.logger.info(`🚰 Attempting to claim from Somnia testnet faucet...`);
    
    // Add random delay before faucet claim
    await this.addDelay("faucet claim operation");
    
    try {
      // Prepare request configuration
      const url = constants.FAUCET.URL;
      const payload = {
        address: this.blockchain.address
      };
      
      // Create headers similar to browser
      const headers = {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Origin': constants.FAUCET.ORIGIN,
        'Referer': constants.FAUCET.REFERER,
        'User-Agent': this.getUserAgent(),
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      };
      
      // Configure request with proxy if needed
      let requestConfig = { 
        headers,
        timeout: 30000 // 30 second timeout
      };
      
      if (proxyManager.isEnabled() && proxyManager.currentProxy) {
        this.logger.info(`Using proxy for faucet request: ${proxyManager.currentProxy}`);
        requestConfig = {
          ...requestConfig,
          ...proxyManager.getAxiosConfig(),
          headers: {
            ...headers,
            ...proxyManager.getHeaders()
          }
        };
      }
      
      // Make the faucet API request with timeout
      this.logger.info(`Sending faucet request to API for address ${this.blockchain.address}`);
      const response = await this.executeWithTimeout(
        axios.post(url, payload, requestConfig),
        30000 // 30 second timeout
      );
      
      // Check response
      if (response.data && response.data.success) {
        this.logger.success(`Faucet request successful: ${response.data.message || 'Request accepted'}`);
        
        // Log status information if available
        if (response.data.data && response.data.data.status) {
          this.logger.info(`Faucet status: ${response.data.data.status}`);
          this.logger.info(`Faucet funds should arrive shortly.`);
        }
        
        return true;
      } else {
        // Handle failure
        const errorMessage = response.data?.error || 'Unknown error';
        this.logger.warn(`Faucet request failed: ${errorMessage}`);
        
        // Handle specific errors
        if (errorMessage.includes('wait 24 hours') || errorMessage.includes('rate limit')) {
          this.logger.info(`This wallet has already claimed funds recently. Skipping faucet and continuing with other operations.`);
          return true; // Don't treat this as an error - it's normal for already funded wallets
        }
        
        return false;
      }
    } catch (error) {
      // Handle network or other errors
      const errorMessage = error.response?.data?.error || error.message;
      this.logger.warn(`Error in faucet claim: ${errorMessage}`);
      
      // Handle rate limit specifically
      if (error.response?.status === 429 || 
          (error.response?.data && error.response.data.error && 
           (error.response.data.error.includes('rate limit') || 
            error.response.data.error.includes('wait 24 hours')))) {
        this.logger.info(`Wallet has already claimed funds recently. Skipping faucet and continuing with other operations.`);
        return true; // Return true so we continue with other operations
      }
      
      return false;
    }
  }
  
  // Implementation of the executeOperations method from BaseOperation
  async executeOperations() {
    try {
      // Just try to claim from faucet - no balance checks or retries for wallet-based rate limits
      const claimResult = await this.claimFromFaucet();
      
      if (claimResult) {
        this.logger.success(`Faucet operation completed.`);
      } else {
        this.logger.warn(`Faucet claim failed. Continuing with other operations.`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error in faucet operations: ${error.message}`);
      return false;
    }
  }
}

module.exports = Faucet;