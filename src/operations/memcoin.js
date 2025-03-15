// Memcoin operations - Token swapping automation
const { ethers } = require('ethers');
const constants = require('../utils/constants');
const BaseOperation = require('./base');
const ContractManager = require('../core/contract');

class Memcoin extends BaseOperation {
  constructor(privateKey, configObj = {}) {
    // Hard-coded configuration based on transaction patterns
    const defaultConfig = {
      enabled: true,
      mint_enabled: true,
      // Base token that will be minted
      base_token: {
        name: "sUSDT",
        address: "0x65296738D4E5edB1515e40287B6FDf8320E6eE04"
      },
      // Tokens for swapping
      swap_tokens: [
        {
          name: "Somini",
          address: "0x7a7045415f3682C3349E4b68d2940204b81fFF33"
        },
        {
          name: "SOMSOM",
          address: "0x6756B4542d545270CacF1F15C3b7DefE589Ba1aa"
        },
        {
          name: "SMI",
          address: "0xC9005DD5C562bDdEF1Cf3C90Ad5B1Bf54fB8aa9d"
        }
      ],
      // Router address for swapping tokens
      router_address: "0x6AAC14f090A35EeA150705f72D90E4CDC4a49b2C",
      // Swap amounts
      buy_amount: 0.1,  // Amount to buy (in sUSDT)
      sell_amount: 0.01, // Amount to sell (in memcoin)
      // Other settings
      slippage: 500,  // 5% slippage
      repeat_times: 1
    };
    
    // Initialize base class
    super(privateKey, configObj, 'memcoin');
    
    // Set default config
    this.defaultConfig = defaultConfig;
    
    // Initialize contract manager
    this.contractManager = new ContractManager(this.blockchain, configObj);
  }

  // Check if minting is enabled
  isMintEnabled() {
    return this.config.get ? 
      this.config.getBoolean('operations.memcoin.mint_enabled', true) :
      (this.config.operations?.memcoin?.mint_enabled !== false); // Default to true if not specified
  }

  // Get base token info
  getBaseToken() {
    return this.defaultConfig.base_token;
  }

  // Get memcoin tokens for swapping
  getSwapTokens() {
    return this.defaultConfig.swap_tokens;
  }

  // Get router address
  getRouterAddress() {
    return this.defaultConfig.router_address;
  }

  // Get Buy Amount
  getBuyAmount() {
    const amount = this.config.get ? 
      this.config.getNumber('operations.memcoin.buy_amount', this.defaultConfig.buy_amount) :
      (this.config.operations?.memcoin?.buy_amount || this.defaultConfig.buy_amount);
    
    return {
      humanReadable: amount,
      raw: this.convertToRawAmount(amount)
    };
  }
  
  // Get Sell Amount
  getSellAmount() {
    const amount = this.config.get ? 
      this.config.getNumber('operations.memcoin.sell_amount', this.defaultConfig.sell_amount) :
      (this.config.operations?.memcoin?.sell_amount || this.defaultConfig.sell_amount);
    
    return {
      humanReadable: amount,
      raw: this.convertToRawAmount(amount)
    };
  }
  
  // Get slippage setting
  getSlippage() {
    return this.config.get ? 
      this.config.getNumber('operations.memcoin.slippage', this.defaultConfig.slippage) :
      (this.config.operations?.memcoin?.slippage || this.defaultConfig.slippage);
  }
  
  // Get repeat times
  getRepeatTimes() {
    return this.config.get ? 
      this.config.getRepeatTimes('memcoin', this.defaultConfig.repeat_times) :
      (this.config.operations?.memcoin?.repeat_times || this.defaultConfig.repeat_times);
  }

  // Helper: Convert to raw amount with 18 decimals (standard for ERC20)
  convertToRawAmount(amount) {
    return BigInt(Math.floor(amount * 10**18)).toString();
  }

  // Helper: Get random amount in range with specified decimal precision
  getRandomAmount(min, max, decimals = 2) {
    const randomValue = min + Math.random() * (max - min);
    const factor = 10 ** decimals;
    return Math.floor(randomValue * factor) / factor;
  }

  // Helper: Pad hex string to 64 characters
  padHex(hexString) {
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    return cleanHex.padStart(64, '0');
  }

  // Mint sUSDT tokens
  async mintSUSDT() {
    try {
      const baseToken = this.getBaseToken();
      this.logger.info(`🪙 Minting ${baseToken.name} tokens...`);
      
      // Add random delay before minting
      await this.addDelay(`mint ${baseToken.name} operation`);
      
      // Encode function data - this is the function selector for mint()
      const data = "0x1249c58b";
      
      // Prepare mint transaction
      const txObject = {
        to: baseToken.address,
        data: data
      };
      
      // Send mint transaction
      const result = await this.blockchain.sendTransaction(txObject, `${baseToken.name} token mint`);
      
      if (!result.success) {
        this.logger.error(`Failed to mint ${baseToken.name} tokens: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Successfully minted ${baseToken.name} tokens`);
      this.logger.success(`Transaction hash: ${result.txHash}`);
      this.logger.success(`View on explorer: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in sUSDT token minting: ${error.message}`);
      return false;
    }
  }

  // Approve token for swap
  async approveToken(tokenAddress, amount) {
    try {
      this.logger.info(`🔓 Approving tokens for swap...`);
      
      // Add random delay before approval
      await this.addDelay("token approval operation");
      
      // Create contract interface for proper ABI encoding
      const approveInterface = new ethers.Interface([
        "function approve(address spender, uint256 amount)"
      ]);
      
      // Encode function data
      const data = approveInterface.encodeFunctionData("approve", [
        this.getRouterAddress(),
        amount.raw
      ]);
      
      // Prepare approve transaction
      const txObject = {
        to: tokenAddress,
        data: data
      };
      
      // Send approval transaction
      const result = await this.blockchain.sendTransaction(txObject, "Token approval");
      
      if (!result.success) {
        this.logger.error(`Failed to approve tokens: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Successfully approved ${amount.humanReadable.toFixed(4)} tokens for swap`);
      this.logger.success(`Transaction hash: ${result.txHash}`);
      this.logger.success(`View on explorer: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in token approval: ${error.message}`);
      return false;
    }
  }

  // Swap tokens
  async swapTokens(fromToken, toToken, amount) {
    try {
      this.logger.info(`🔄 Swapping ${fromToken.name} tokens for ${toToken.name} tokens...`);
      
      // Add random delay before swap
      await this.addDelay("token swap operation");
      
      // Get slippage
      const slippage = this.getSlippage();
      this.logger.info(`Using slippage: ${slippage} basis points (${slippage/100}%)`);
      
      // Convert amount to hex without 0x prefix and pad to 64 chars
      const amountHex = BigInt(amount.raw).toString(16);
      const paddedAmountHex = this.padHex(amountHex);
      
      // Convert slippage to hex and pad
      const slippageHex = slippage.toString(16);
      const paddedSlippageHex = this.padHex(slippageHex);
      
      // Build swap data
      const swapData = `0x04e45aaf` + // Function signature
        `000000000000000000000000${fromToken.address.slice(2)}` + // tokenIn
        `000000000000000000000000${toToken.address.slice(2)}` + // tokenOut
        `${paddedSlippageHex}` + // slippage
        `000000000000000000000000${this.blockchain.address.slice(2)}` + // recipient
        `${paddedAmountHex}` + // amountIn
        `0000000000000000000000000000000000000000000000000000000000000000` + // amountOutMin (0)
        `0000000000000000000000000000000000000000000000000000000000000000`; // deadline (0)
      
      // Prepare swap transaction
      const txObject = {
        to: this.getRouterAddress(),
        data: swapData,
        gas: 500000
      };
      
      // Send swap transaction
      const result = await this.blockchain.sendTransaction(txObject, `${fromToken.name} to ${toToken.name} swap`);
      
      if (!result.success) {
        this.logger.error(`Failed to swap tokens: ${result.error}`);
        return false;
      }
      
      this.logger.success(`Successfully swapped ${amount.humanReadable.toFixed(4)} ${fromToken.name} tokens for ${toToken.name}`);
      this.logger.success(`Transaction hash: ${result.txHash}`);
      this.logger.success(`View on explorer: ${constants.NETWORK.EXPLORER_URL}/tx/${result.txHash}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error in token swap: ${error.message}`);
      return false;
    }
  }

  // Main operation execution
  async executeOperations() {
    try {
      const baseToken = this.getBaseToken();
      const swapTokens = this.getSwapTokens();
      const repeatTimes = this.getRepeatTimes();
      
      this.logger.info(`📍 Starting memcoin operations for tokens: ${swapTokens.map(t => t.name).join(', ')}`);
      this.logger.info(`🔄 Will perform ${repeatTimes} memcoin operation cycles...`);
      
      // Perform operations for each cycle
      for (let i = 0; i < repeatTimes; i++) {
        this.logger.info(`📍 Memcoin operation cycle ${i+1}/${repeatTimes}`);
        
        // Step 1: Mint sUSDT tokens (if enabled)
        if (this.isMintEnabled()) {
          const mintSuccess = await this.mintSUSDT();
          if (!mintSuccess) {
            this.logger.warn(`${baseToken.name} minting failed, continuing with next operations`);
          }
        } else {
          this.logger.info(`Minting is disabled in config, skipping ${baseToken.name} mint step`);
        }
        
        // Process each memcoin
        for (const token of swapTokens) {
          this.logger.info(`Processing ${token.name} token...`);
          
          // Get amounts for buying
          const buyAmount = this.getBuyAmount();
          
          // Step 2: Approve sUSDT for swap
          const approveSuccess = await this.approveToken(baseToken.address, buyAmount);
          
          if (!approveSuccess) {
            this.logger.warn(`Skipping ${token.name} operations due to approval failure`);
            continue;
          }
          
          // Step 3: Swap sUSDT for the token (buy)
          const buyResult = await this.swapTokens(baseToken, token, buyAmount);
          
          if (!buyResult) {
            this.logger.warn(`Buy operation failed for ${token.name}, skipping sell step`);
            continue;
          }
          
          // Wait a bit before selling
          await this.addDelay(`preparing to sell ${token.name}`);
          
          // Get smaller amount for selling
          const sellAmount = this.getSellAmount();
          
          // Step 4: Approve token for swap back
          const tokenApproveSuccess = await this.approveToken(token.address, sellAmount);
          
          if (!tokenApproveSuccess) {
            this.logger.warn(`Skipping ${token.name} sell operation due to approval failure`);
            continue;
          }
          
          // Step 5: Swap token back to sUSDT (sell)
          await this.swapTokens(token, baseToken, sellAmount);
        }
        
        // Add delay between cycles if not the last one
        if (i < repeatTimes - 1) {
          this.logger.info(`⏳ Waiting before next memcoin operation cycle...`);
          await this.addDelay(`next memcoin cycle (${i+2}/${repeatTimes})`);
        }
      }
      
      this.logger.success(`Memcoin operations completed successfully!`);
      return true;
    } catch (error) {
      this.logger.error(`Error in memcoin operations: ${error.message}`);
      return false;
    }
  }
}

module.exports = Memcoin;