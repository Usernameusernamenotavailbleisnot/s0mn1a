/**
 * TokenSwap Operation
 * Handles minting and swapping PING/PONG tokens
 */
const { ethers } = require('ethers');
const Operation = require('../core/operation');
const constants = require('../utils/constants');
const { wait } = require('../utils/delay');
const { isRetryableError } = require('../utils/error');

class TokenSwap extends Operation {
  /**
   * Create new token swap operation
   * @param {Object} blockchain Blockchain instance
   * @param {Object} config Configuration object
   */
  constructor(blockchain, config = {}) {
    // Initialize base class
    super(blockchain, config, 'tokenswap');
  }
  
  /**
   * Convert to raw amount with 18 decimals (standard for ERC20)
   * @param {number} amount Amount as number
   * @returns {string} Formatted amount as string
   */
  convertToRawAmount(amount) {
    return BigInt(Math.floor(amount * 10**18)).toString();
  }
  
  /**
   * Get random amount in range with specified decimal precision
   * @param {number} min Minimum amount
   * @param {number} max Maximum amount
   * @param {number} decimals Decimal precision
   * @returns {number} Random amount
   */
  getRandomAmount(min, max, decimals = 2) {
    const randomValue = min + Math.random() * (max - min);
    const factor = 10 ** decimals;
    return Math.floor(randomValue * factor) / factor;
  }
  
  /**
   * Calculate mint amount
   * @returns {Object} Amount in human-readable and raw formats
   */
  calculateMintAmount() {
    const amount = this.config.get ? 
      this.config.getNumber('operations.tokenswap.mint.amount', 1000) :
      (this.config.operations?.tokenswap?.mint?.amount || 1000);
    
    const rawAmount = this.convertToRawAmount(amount);
    
    return {
      humanReadable: amount,
      raw: rawAmount
    };
  }
  
  /**
   * Calculate swap amount for a token
   * @param {string} tokenAddress Token contract address
   * @returns {Promise<Object>} Amount in human-readable and raw formats
   */
  async calculateSwapAmount(tokenAddress) {
    const usePercentage = this.config.get ? 
      this.config.getBoolean('operations.tokenswap.swap.use_percentage', true) :
      (this.config.operations?.tokenswap?.swap?.use_percentage ?? true);
    
    if (usePercentage) {
      try {
        // Create contract instance to check balance
        const abi = [
          {
            "constant": true,
            "inputs": [{"name": "account", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "", "type": "uint256"}],
            "type": "function"
          }
        ];
        
        const contract = new ethers.Contract(
          tokenAddress,
          abi,
          this.blockchain.provider
        );
        
        // Get token balance
        const balance = await contract.balanceOf(this.blockchain.address);
        
        // Get percentage from config
        const percentage = this.config.get ? 
          this.config.getNumber('operations.tokenswap.swap.percentage', 10) :
          (this.config.operations?.tokenswap?.swap?.percentage || 10);
        
        // Calculate amount based on percentage
        const rawAmount = (BigInt(balance) * BigInt(percentage) / BigInt(100)).toString();
        
        // Calculate human readable amount (tokens are always 18 decimals)
        const humanReadable = Number(ethers.formatUnits(rawAmount, 18));
        
        return {
          humanReadable: humanReadable,
          raw: rawAmount
        };
      } catch (error) {
        this.logger.error(`Error calculating percentage-based amount: ${error.message}`);
        
        // Fallback to fixed amount
        this.logger.info(`Falling back to fixed amount`);
        return this.calculateFixedSwapAmount();
      }
    } else {
      return this.calculateFixedSwapAmount();
    }
  }
  
  /**
   * Calculate fixed swap amount
   * @returns {Object} Amount in human-readable and raw formats
   */
  calculateFixedSwapAmount() {
    const minAmount = this.config.get ? 
      this.config.getNumber('operations.tokenswap.swap.fixed_amount.min', 0.5) :
      (this.config.operations?.tokenswap?.swap?.fixed_amount?.min || 0.5);
    
    const maxAmount = this.config.get ? 
      this.config.getNumber('operations.tokenswap.swap.fixed_amount.max', 5) :
      (this.config.operations?.tokenswap?.swap?.fixed_amount?.max || 5);
    
    const decimals = this.config.get ? 
      this.config.getNumber('operations.tokenswap.swap.fixed_amount.decimals', 2) :
      (this.config.operations?.tokenswap?.swap?.fixed_amount?.decimals || 2);
    
    let amount;
    if (minAmount === maxAmount) {
      amount = minAmount;
    } else {
      amount = this.getRandomAmount(minAmount, maxAmount, decimals);
    }
    
    const rawAmount = this.convertToRawAmount(amount);
    
    return {
      humanReadable: amount,
      raw: rawAmount
    };
  }
  
  /**
   * Pad hex value to 64 characters (32 bytes)
   * @param {string} hexString Hex string to pad
   * @returns {string} Padded hex string
   */
  padHex(hexString) {
    // Remove '0x' prefix if present
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    // Pad to 64 characters
    return cleanHex.padStart(64, '0');
  }
  
  /**
   * Get retry configuration
   * @returns {Object} Retry config
   */
  getRetryConfig() {
    return {
      maxAttempts: this.config.get ? 
        this.config.getNumber('operations.tokenswap.retry.max_attempts', 3) :
        (this.config.operations?.tokenswap?.retry?.max_attempts || 3),
      
      delayMs: this.config.get ? 
        this.config.getNumber('operations.tokenswap.retry.delay_ms', 2000) :
        (this.config.operations?.tokenswap?.retry?.delay_ms || 2000),
      
      gasIncrease: this.config.get ? 
        this.config.getNumber('operations.tokenswap.retry.gas_increase', 1.2) :
        (this.config.operations?.tokenswap?.retry?.gas_increase || 1.2)
    };
  }
  
  /**
   * Execute transaction with retry mechanism
   * @param {Object} txObject Transaction object
   * @param {string} operationName Operation name for logging
   * @returns {Promise<Object>} Transaction result
   */
  async executeWithRetry(txObject, operationName) {
    const retryConfig = this.getRetryConfig();
    let attempt = 0;
    let lastError = null;
    
    while (attempt < retryConfig.maxAttempts) {
      try {
        attempt++;
        
        if (attempt > 1) {
          // If this is a retry, increase gas
          const increasedGas = Math.floor(Number(txObject.gas || 500000) * retryConfig.gasIncrease);
          txObject.gas = increasedGas;
          
          this.logger.info(`Retry attempt ${attempt}/${retryConfig.maxAttempts} for ${operationName}`);
          this.logger.info(`Increased gas to: ${increasedGas}`);
          
          // Wait before retry
          const delayMs = retryConfig.delayMs * (attempt - 1);
          this.logger.info(`Waiting ${delayMs}ms before retry...`);
          await wait(delayMs);
        }
        
        // Send transaction
        const result = await this.blockchain.sendTransaction(txObject, operationName);
        
        if (result.success) {
          if (attempt > 1) {
            this.logger.success(`${operationName} succeeded on attempt ${attempt}/${retryConfig.maxAttempts}`);
          }
          return result;
        } else {
          lastError = result.error;
          this.logger.warn(`${operationName} failed on attempt ${attempt}/${retryConfig.maxAttempts}: ${result.error}`);
          
          // Check if we should retry based on error
          if (isRetryableError(result.error)) {
            continue;
          } else {
            this.logger.error(`Non-retryable error detected: ${result.error}`);
            return result;
          }
        }
      } catch (error) {
        lastError = error.message;
        this.logger.warn(`Exception in ${operationName} on attempt ${attempt}/${retryConfig.maxAttempts}: ${error.message}`);
        
        if (attempt < retryConfig.maxAttempts) {
          // Wait before retry
          const delayMs = retryConfig.delayMs * attempt;
          this.logger.info(`Waiting ${delayMs}ms before retry...`);
          await wait(delayMs);
        }
      }
    }
    
    this.logger.error(`${operationName} failed after ${retryConfig.maxAttempts} attempts`);
    return {
      success: false,
      error: lastError || `Failed after ${retryConfig.maxAttempts} attempts`,
      details: { attemptsCount: attempt }
    };
  }
  /**
   * Check if minting is enabled
   * @returns {boolean} Whether minting is enabled
   */
  isMintEnabled() {
    return this.config.get ? 
      this.config.getBoolean('operations.tokenswap.mint.enabled', true) :
      (this.config.operations?.tokenswap?.mint?.enabled !== false); // Default to true if not specified
  }
  
  /**
   * Check if swapping is enabled
   * @returns {boolean} Whether swapping is enabled
   */
  isSwapEnabled() {
    return this.config.get ? 
      this.config.getBoolean('operations.tokenswap.swap.enabled', true) :
      (this.config.operations?.tokenswap?.swap?.enabled !== false); // Default to true if not specified
  }
  
  /**
   * Check token allowance
   * @param {string} tokenAddress Token contract address
   * @param {string} spenderAddress Spender address (router)
   * @returns {Promise<BigInt>} Current allowance
   */
  async checkAllowance(tokenAddress, spenderAddress) {
    try {
      // Standard ERC20 allowance function
      const abi = [
        {
          "constant": true,
          "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"}
          ],
          "name": "allowance",
          "outputs": [{"name": "", "type": "uint256"}],
          "type": "function"
        }
      ];
      
      const contract = new ethers.Contract(
        tokenAddress,
        abi,
        this.blockchain.provider
      );
      
      // Get current allowance
      const allowance = await contract.allowance(this.blockchain.address, spenderAddress);
      return allowance;
    } catch (error) {
      this.logger.error(`Error checking allowance: ${error.message}`);
      return BigInt(0); // Return 0 allowance on error to trigger approval
    }
  }
  
  /**
   * Mint PING tokens
   * @returns {Promise<boolean>} Success status
   */
  async mintPingTokens() {
    try {
      // Check if minting is enabled
      if (!this.isMintEnabled()) {
        this.logger.info(`PING token minting is disabled in config`);
        return true; // Return true to not interrupt flow
      }
      
      this.logger.info(`🪙 Minting PING tokens...`);
      
      // Add random delay before minting
      await this.addDelay("mint PING operation");
      
      // Calculate mint amount
      const mintAmount = this.calculateMintAmount();
      
      // Create contract interface for proper ABI encoding
      const mintInterface = new ethers.Interface([
        "function mint(address to, uint256 amount)"
      ]);
      
      // Encode function data properly
      const data = mintInterface.encodeFunctionData("mint", [
        this.blockchain.address,
        mintAmount.raw
      ]);
      
      // Prepare mint transaction
      const txObject = {
        to: constants.TOKEN.PING_ADDRESS,
        data: data
      };
      
      // Send mint transaction with retry
      const result = await this.executeWithRetry(txObject, "PING token mint");
      
      if (!result.success) {
        this.logger.error(`Failed to mint PING tokens: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Successfully minted ${mintAmount.humanReadable.toFixed(2)} PING tokens`);
      this.logger.success(`Transaction hash: ${result.txHash}`);
      this.logger.success(`View on explorer: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in PING token minting: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Mint PONG tokens
   * @returns {Promise<boolean>} Success status
   */
  async mintPongTokens() {
    try {
      // Check if minting is enabled
      if (!this.isMintEnabled()) {
        this.logger.info(`PONG token minting is disabled in config`);
        return true; // Return true to not interrupt flow
      }
      
      this.logger.info(`🪙 Minting PONG tokens...`);
      
      // Add random delay before minting
      await this.addDelay("mint PONG operation");
      
      // Calculate mint amount
      const mintAmount = this.calculateMintAmount();
      
      // Create contract interface for proper ABI encoding
      const mintInterface = new ethers.Interface([
        "function mint(address to, uint256 amount)"
      ]);
      
      // Encode function data properly
      const data = mintInterface.encodeFunctionData("mint", [
        this.blockchain.address,
        mintAmount.raw
      ]);
      
      // Prepare mint transaction
      const txObject = {
        to: constants.TOKEN.PONG_ADDRESS,
        data: data
      };
      
      // Send mint transaction with retry
      const result = await this.executeWithRetry(txObject, "PONG token mint");
      
      if (!result.success) {
        this.logger.error(`Failed to mint PONG tokens: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Successfully minted ${mintAmount.humanReadable.toFixed(2)} PONG tokens`);
      this.logger.success(`Transaction hash: ${result.txHash}`);
      this.logger.success(`View on explorer: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in PONG token minting: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Approve PONG tokens for swap
   * @param {Object} swapAmount Amount to approve
   * @returns {Promise<boolean>} Success status
   */
  async approvePongForSwapWithAmount(swapAmount) {
    try {
      // Check if swapping is enabled
      if (!this.isSwapEnabled()) {
        this.logger.info(`Token swapping is disabled in config`);
        return true; // Return true to not interrupt flow
      }
      
      // Check current allowance
      const currentAllowance = await this.checkAllowance(
        constants.TOKEN.PONG_ADDRESS, 
        constants.TOKEN.ROUTER_ADDRESS
      );
      
      this.logger.info(`Current PONG allowance: ${ethers.formatUnits(currentAllowance, 18)} PONG`);
      this.logger.info(`Required PONG allowance: ${swapAmount.humanReadable.toFixed(4)} PONG`);
      
      // Check if allowance is already sufficient
      if (BigInt(currentAllowance) >= BigInt(swapAmount.raw)) {
        this.logger.success(`Existing PONG allowance is sufficient, no approval needed`);
        return true;
      }
      
      this.logger.info(`🔓 Approving PONG tokens for swap...`);
      
      // Add random delay before approval
      await this.addDelay("approve PONG operation");
      
      // Create contract interface for proper ABI encoding
      const approveInterface = new ethers.Interface([
        "function approve(address spender, uint256 amount)"
      ]);
      
      // Encode function data properly
      const data = approveInterface.encodeFunctionData("approve", [
        constants.TOKEN.ROUTER_ADDRESS,
        swapAmount.raw
      ]);
      
      // Prepare approve transaction
      const txObject = {
        to: constants.TOKEN.PONG_ADDRESS,
        data: data
      };
      
      // Send approve transaction with retry
      const result = await this.executeWithRetry(txObject, "PONG token approval");
      
      if (!result.success) {
        this.logger.error(`Failed to approve PONG tokens: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Successfully approved ${swapAmount.humanReadable.toFixed(4)} PONG tokens for swap`);
      this.logger.success(`Transaction hash: ${result.txHash}`);
      this.logger.success(`View on explorer: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in PONG token approval: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Swap PONG tokens for PING
   * @param {Object} swapAmount Amount to swap
   * @returns {Promise<boolean>} Success status
   */
  async swapPongForPingWithAmount(swapAmount) {
    try {
      // Check if swapping is enabled
      if (!this.isSwapEnabled()) {
        this.logger.info(`Token swapping is disabled in config`);
        return true; // Return true to not interrupt flow
      }
      
      this.logger.info(`🔄 Swapping PONG tokens for PING tokens...`);
      
      // Add random delay before swap
      await this.addDelay("swap PONG to PING operation");
      
      this.logger.info(`Swap amount: ${swapAmount.humanReadable} PONG (${swapAmount.raw} wei)`);
      
      // Get slippage from config
      const slippage = this.config.get ? 
        this.config.getNumber('operations.tokenswap.slippage', 500) :
        (this.config.operations?.tokenswap?.slippage || 500); // 5.00% in basis points
      
      this.logger.info(`Using slippage: ${slippage} basis points (${slippage/100}%)`);
      
      // Convert amount to hex without 0x prefix and pad to 64 chars
      const amountHex = BigInt(swapAmount.raw).toString(16);
      const paddedAmountHex = this.padHex(amountHex);
      
      // Convert slippage to hex and pad
      const slippageHex = slippage.toString(16);
      const paddedSlippageHex = this.padHex(slippageHex);
      
      // Build data exactly as in the successful transaction
      const swapData = `0x04e45aaf` + // Function signature
        `000000000000000000000000${constants.TOKEN.PONG_ADDRESS.slice(2)}` + // tokenIn (PONG)
        `000000000000000000000000${constants.TOKEN.PING_ADDRESS.slice(2)}` + // tokenOut (PING)
        `${paddedSlippageHex}` + // slippage (from config)
        `000000000000000000000000${this.blockchain.address.slice(2)}` + // recipient
        `${paddedAmountHex}` + // amountIn (from config)
        `0000000000000000000000000000000000000000000000000000000000000000` + // amountOutMin (0)
        `0000000000000000000000000000000000000000000000000000000000000000`; // deadline (0)
      
      // Prepare swap transaction with fixed gas limit, using 'gas' parameter
      const txObject = {
        to: constants.TOKEN.ROUTER_ADDRESS,
        data: swapData,
        gas: 500000
      };
      
      // Send swap transaction with retry
      const result = await this.executeWithRetry(txObject, "PONG to PING swap");
      
      if (!result.success) {
        this.logger.error(`Failed to swap PONG tokens: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Successfully swapped ${swapAmount.humanReadable.toFixed(4)} PONG tokens for PING tokens`);
      this.logger.success(`Transaction hash: ${result.txHash}`);
      this.logger.success(`View on explorer: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in PONG to PING swap: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Approve PING tokens for swap
   * @param {Object} swapAmount Amount to approve
   * @returns {Promise<boolean>} Success status
   */
  async approvePingForSwapWithAmount(swapAmount) {
    try {
      // Check if swapping is enabled
      if (!this.isSwapEnabled()) {
        this.logger.info(`Token swapping is disabled in config`);
        return true; // Return true to not interrupt flow
      }
      
      // Check current allowance
      const currentAllowance = await this.checkAllowance(
        constants.TOKEN.PING_ADDRESS, 
        constants.TOKEN.ROUTER_ADDRESS
      );
      
      this.logger.info(`Current PING allowance: ${ethers.formatUnits(currentAllowance, 18)} PING`);
      this.logger.info(`Required PING allowance: ${swapAmount.humanReadable.toFixed(4)} PING`);
      
      // Check if allowance is already sufficient
      if (BigInt(currentAllowance) >= BigInt(swapAmount.raw)) {
        this.logger.success(`Existing PING allowance is sufficient, no approval needed`);
        return true;
      }
      
      this.logger.info(`🔓 Approving PING tokens for swap...`);
      
      // Add random delay before approval
      await this.addDelay("approve PING operation");
      
      // Create contract interface for proper ABI encoding
      const approveInterface = new ethers.Interface([
        "function approve(address spender, uint256 amount)"
      ]);
      
      // Encode function data properly
      const data = approveInterface.encodeFunctionData("approve", [
        constants.TOKEN.ROUTER_ADDRESS,
        swapAmount.raw
      ]);
      
      // Prepare approve transaction
      const txObject = {
        to: constants.TOKEN.PING_ADDRESS,
        data: data
      };
      
      // Send approve transaction with retry
      const result = await this.executeWithRetry(txObject, "PING token approval");
      
      if (!result.success) {
        this.logger.error(`Failed to approve PING tokens: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Successfully approved ${swapAmount.humanReadable.toFixed(4)} PING tokens for swap`);
      this.logger.success(`Transaction hash: ${result.txHash}`);
      this.logger.success(`View on explorer: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in PING token approval: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Swap PING tokens for PONG
   * @param {Object} swapAmount Amount to swap
   * @returns {Promise<boolean>} Success status
   */
  async swapPingForPongWithAmount(swapAmount) {
    try {
      // Check if swapping is enabled
      if (!this.isSwapEnabled()) {
        this.logger.info(`Token swapping is disabled in config`);
        return true; // Return true to not interrupt flow
      }
      
      this.logger.info(`🔄 Swapping PING tokens for PONG tokens...`);
      
      // Add random delay before swap
      await this.addDelay("swap PING to PONG operation");
      
      this.logger.info(`Swap amount: ${swapAmount.humanReadable} PING (${swapAmount.raw} wei)`);
      
      // Get slippage from config
      const slippage = this.config.get ? 
        this.config.getNumber('operations.tokenswap.slippage', 500) :
        (this.config.operations?.tokenswap?.slippage || 500); // 5.00% in basis points
      
      this.logger.info(`Using slippage: ${slippage} basis points (${slippage/100}%)`);
      
      // Convert amount to hex without 0x prefix and pad to 64 chars
      const amountHex = BigInt(swapAmount.raw).toString(16);
      const paddedAmountHex = this.padHex(amountHex);
      
      // Convert slippage to hex and pad
      const slippageHex = slippage.toString(16);
      const paddedSlippageHex = this.padHex(slippageHex);
      
      // Build data exactly as in the successful transaction
      const swapData = `0x04e45aaf` + // Function signature
        `000000000000000000000000${constants.TOKEN.PING_ADDRESS.slice(2)}` + // tokenIn (PING)
        `000000000000000000000000${constants.TOKEN.PONG_ADDRESS.slice(2)}` + // tokenOut (PONG)
        `${paddedSlippageHex}` + // slippage (from config)
        `000000000000000000000000${this.blockchain.address.slice(2)}` + // recipient
        `${paddedAmountHex}` + // amountIn (from config)
        `0000000000000000000000000000000000000000000000000000000000000000` + // amountOutMin (0)
        `0000000000000000000000000000000000000000000000000000000000000000`; // deadline (0)
      
      // Prepare swap transaction with fixed gas limit, using 'gas' parameter
      const txObject = {
        to: constants.TOKEN.ROUTER_ADDRESS,
        data: swapData,
        gas: 500000
      };
      
      // Send swap transaction with retry
      const result = await this.executeWithRetry(txObject, "PING to PONG swap");
      
      if (!result.success) {
        this.logger.error(`Failed to swap PING tokens: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Successfully swapped ${swapAmount.humanReadable.toFixed(4)} PING tokens for PONG tokens`);
      this.logger.success(`Transaction hash: ${result.txHash}`);
      this.logger.success(`View on explorer: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in PING to PONG swap: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Implementation of the executeOperations method from Operation base class
   * @returns {Promise<boolean>} Success status
   */
  async executeOperations() {
    try {
      // Get repeat count from config
      const repeatTimes = this.config.get ? 
        this.config.getRepeatTimes('tokenswap', 1) :
        (this.config.operations?.tokenswap?.repeat_times || 1);
      
      this.logger.info(`🔄 Will perform ${repeatTimes} token mint and swap operations...`);
      
      let successCount = 0;
      for (let i = 0; i < repeatTimes; i++) {
        this.logger.info(`📍 Token operation cycle ${i+1}/${repeatTimes}`);
        
        // Mint PING tokens
        const pingMintSuccess = await this.mintPingTokens();
        if (!pingMintSuccess && this.isMintEnabled()) {
          this.logger.warn(`PING minting failed, but continuing with remaining operations`);
        }
        
        // Mint PONG tokens
        const pongMintSuccess = await this.mintPongTokens();
        if (!pongMintSuccess && this.isMintEnabled()) {
          this.logger.warn(`PONG minting failed, but continuing with remaining operations`);
        }
        
        if (this.isSwapEnabled()) {
          // Pre-calculate swap amounts to ensure consistency
          
          // Calculate PONG->PING swap amount once and store it
          const pongSwapAmount = await this.calculateSwapAmount(constants.TOKEN.PONG_ADDRESS);
          this.logger.info(`Pre-calculated PONG swap amount: ${pongSwapAmount.humanReadable} PONG`);
          
          // Approve PONG tokens for swap using the pre-calculated amount
          const pongApproveSuccess = await this.approvePongForSwapWithAmount(pongSwapAmount);
          if (!pongApproveSuccess) {
            this.logger.warn(`PONG->PING swap may fail due to approval failure`);
          } else {
            // Only perform swap if approval was successful
            // Swap PONG -> PING using the same pre-calculated amount
            await this.swapPongForPingWithAmount(pongSwapAmount);
          }
          
          // Calculate PING->PONG swap amount once and store it
          const pingSwapAmount = await this.calculateSwapAmount(constants.TOKEN.PING_ADDRESS);
          this.logger.info(`Pre-calculated PING swap amount: ${pingSwapAmount.humanReadable} PING`);
          
          // Approve PING tokens for swap using the pre-calculated amount
          const pingApproveSuccess = await this.approvePingForSwapWithAmount(pingSwapAmount);
          if (!pingApproveSuccess) {
            this.logger.warn(`PING->PONG swap may fail due to approval failure`);
          } else {
            // Only perform swap if approval was successful
            // Swap PING -> PONG using the same pre-calculated amount
            await this.swapPingForPongWithAmount(pingSwapAmount);
          }
        }
        
        successCount++;
       
        // Add delay between repeat cycles if not the last one
        if (i < repeatTimes - 1) {
          this.logger.info(`⏳ Waiting before next token operation cycle...`);
          await this.addDelay(`next token operation cycle (${i+2}/${repeatTimes})`);
        }
      }
      
      this.logger.success(`Token mint and swap operations completed: ${successCount}/${repeatTimes} cycles successful`);
      return successCount > 0;
      
    } catch (error) {
      this.logger.error(`Error in token mint and swap operations: ${error.message}`);
      return false;
    }
  }
 }
 
 module.exports = TokenSwap;