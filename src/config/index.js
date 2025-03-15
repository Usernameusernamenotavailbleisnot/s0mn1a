/**
 * Configuration Manager
 * Handles loading, validation, and access to application configuration
 */
const fs = require('fs').promises;
const path = require('path');
const _ = require('lodash');
const inquirer = require('inquirer');
const logger = require('../utils/logger');
const defaultConfig = require('./default');
const { configPrompts } = require('./inquirer');

class ConfigManager {
  constructor() {
    this.config = {};
    this.walletNum = null;
    this.logger = logger.getInstance();
    this.configPath = path.join(process.cwd(), 'config.json');
    this.interactive = process.env.NON_INTERACTIVE !== 'true';
  }

  /**
   * Load configuration from file or create new with interactive prompts
   * @param {boolean} forceInteractive Force interactive setup even if config exists
   * @returns {Promise<Object>} The loaded configuration
   */
  async load(forceInteractive = true) {
    try {
      const configExists = await this.checkConfigExists();
      
      if (configExists && !forceInteractive) {
        this.logger.success(`Found config.json`);
        await this.loadFromFile();
      } else {
        if (configExists) {
          this.logger.info(`Configuration file exists, but starting interactive setup for this session...`);
          // Load existing config first so we can use values as defaults
          await this.loadFromFile();
        } else {
          this.logger.info(`No configuration file found, starting interactive setup...`);
        }
        
        if (this.interactive) {
          await this.createInteractive();
        } else {
          this.logger.info(`Using default configuration (non-interactive mode)`);
          this.config = defaultConfig;
        }
      }
      
      this.logger.info(`Configuration loaded successfully`);
      return this.config;
    } catch (error) {
      this.logger.error(`Error loading configuration: ${error.message}`);
      this.logger.info(`Falling back to default configuration`);
      this.config = defaultConfig;
      return this.config;
    }
  }

  /**
   * Check if config file exists
   * @returns {Promise<boolean>}
   */
  async checkConfigExists() {
    try {
      await fs.access(this.configPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Load configuration from file
   * @returns {Promise<void>}
   */
  async loadFromFile() {
    try {
      const fileContent = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Failed to parse config.json: ${error.message}`);
    }
  }

  /**
   * Create configuration interactively using inquirer
   * @returns {Promise<void>}
   */
  async createInteractive() {
    try {
      this.logger.info('Starting interactive configuration setup...');
      
      // Run through configuration prompts
      const answers = await inquirer.prompt(configPrompts(this.config));
      
      // Process answers into config structure
      this.config = this.processAnswers(answers);
      
      // Save the config
      await this.save();
      
      this.logger.success('Configuration created successfully!');
    } catch (error) {
      this.logger.error(`Error in interactive configuration: ${error.message}`);
      this.logger.info('Using default configuration');
      this.config = defaultConfig;
    }
  }

  /**
   * Process inquirer answers into configuration object
   * @param {Object} answers User answers from inquirer
   * @returns {Object} Processed configuration
   */
  processAnswers(answers) {
    const config = _.cloneDeep(defaultConfig);
    
    // General settings
    config.general.gas_price_multiplier = answers.gasPriceMultiplier;
    if (answers.hasOwnProperty('maxRetries')) {
      config.general.max_retries = answers.maxRetries;
    }
    if (answers.hasOwnProperty('delayMinSeconds') && answers.hasOwnProperty('delayMaxSeconds')) {
      config.general.delay = {
        min_seconds: answers.delayMinSeconds,
        max_seconds: answers.delayMaxSeconds
      };
    }
    
    // Enable/disable operations
    Object.keys(config.operations).forEach(op => {
      if (answers.enabledOperations.includes(op)) {
        config.operations[op].enabled = true;
      } else {
        config.operations[op].enabled = false;
      }
    });
    
    // Faucet configuration
    if (answers.enabledOperations.includes('faucet')) {
      if (answers.hasOwnProperty('faucet_max_attempts')) {
        config.operations.faucet.retry.max_attempts = answers.faucet_max_attempts;
      }
      if (answers.hasOwnProperty('faucet_delay_ms')) {
        config.operations.faucet.retry.delay_ms = answers.faucet_delay_ms;
      }
    }
    
    // TokenSwap configuration
    if (answers.enabledOperations.includes('tokenswap')) {
      if (answers.hasOwnProperty('tokenswap_mint_enabled')) {
        config.operations.tokenswap.mint.enabled = answers.tokenswap_mint_enabled;
      }
      if (answers.hasOwnProperty('tokenswap_mint_amount')) {
        config.operations.tokenswap.mint.amount = answers.tokenswap_mint_amount;
      }
      if (answers.hasOwnProperty('tokenswap_swap_enabled')) {
        config.operations.tokenswap.swap.enabled = answers.tokenswap_swap_enabled;
      }
      if (answers.hasOwnProperty('tokenswap_use_percentage')) {
        config.operations.tokenswap.swap.use_percentage = answers.tokenswap_use_percentage;
      }
      if (answers.hasOwnProperty('tokenswap_percentage')) {
        config.operations.tokenswap.swap.percentage = answers.tokenswap_percentage;
      }
      if (answers.hasOwnProperty('tokenswap_fixed_min') && 
          answers.hasOwnProperty('tokenswap_fixed_max') && 
          answers.hasOwnProperty('tokenswap_fixed_decimals')) {
        config.operations.tokenswap.swap.fixed_amount = {
          min: answers.tokenswap_fixed_min,
          max: answers.tokenswap_fixed_max,
          decimals: answers.tokenswap_fixed_decimals
        };
      }
      if (answers.hasOwnProperty('tokenswap_slippage')) {
        config.operations.tokenswap.slippage = answers.tokenswap_slippage;
      }
      if (answers.hasOwnProperty('tokenswap_repeat_times')) {
        config.operations.tokenswap.repeat_times = answers.tokenswap_repeat_times;
      }
      if (answers.hasOwnProperty('tokenswap_retry_attempts') && 
          answers.hasOwnProperty('tokenswap_retry_delay') && 
          answers.hasOwnProperty('tokenswap_gas_increase')) {
        config.operations.tokenswap.retry = {
          max_attempts: answers.tokenswap_retry_attempts,
          delay_ms: answers.tokenswap_retry_delay,
          gas_increase: answers.tokenswap_gas_increase
        };
      }
    }
    
    // Memcoin configuration
    if (answers.enabledOperations.includes('memcoin')) {
      if (answers.hasOwnProperty('memcoin_mint_enabled')) {
        config.operations.memcoin.mint_enabled = answers.memcoin_mint_enabled;
      }
      if (answers.hasOwnProperty('memcoin_buy_amount')) {
        config.operations.memcoin.buy_amount = answers.memcoin_buy_amount;
      }
      if (answers.hasOwnProperty('memcoin_sell_amount')) {
        config.operations.memcoin.sell_amount = answers.memcoin_sell_amount;
      }
      if (answers.hasOwnProperty('memcoin_slippage')) {
        config.operations.memcoin.slippage = answers.memcoin_slippage;
      }
      if (answers.hasOwnProperty('memcoin_repeat_times')) {
        config.operations.memcoin.repeat_times = answers.memcoin_repeat_times;
      }
    }
    
    // Transfer configuration
    if (answers.enabledOperations.includes('transfer')) {
      if (answers.hasOwnProperty('transfer_use_percentage')) {
        config.operations.transfer.use_percentage = answers.transfer_use_percentage;
      }
      if (answers.hasOwnProperty('transfer_percentage')) {
        config.operations.transfer.percentage = answers.transfer_percentage;
      }
      if (answers.hasOwnProperty('transfer_fixed_min') && 
          answers.hasOwnProperty('transfer_fixed_max') && 
          answers.hasOwnProperty('transfer_fixed_decimals')) {
        config.operations.transfer.fixed_amount = {
          min: answers.transfer_fixed_min,
          max: answers.transfer_fixed_max,
          decimals: answers.transfer_fixed_decimals
        };
      }
      if (answers.hasOwnProperty('transfer_count_min') && 
          answers.hasOwnProperty('transfer_count_max')) {
        config.operations.transfer.count = {
          min: answers.transfer_count_min,
          max: answers.transfer_count_max
        };
      }
      if (answers.hasOwnProperty('transfer_repeat_times')) {
        config.operations.transfer.repeat_times = answers.transfer_repeat_times;
      }
    }
    
    // ERC20 configuration
    if (answers.enabledOperations.includes('erc20')) {
      if (answers.hasOwnProperty('erc20_mint_min') && 
          answers.hasOwnProperty('erc20_mint_max')) {
        config.operations.erc20.mint_amount = {
          min: answers.erc20_mint_min,
          max: answers.erc20_mint_max
        };
      }
      if (answers.hasOwnProperty('erc20_burn_percentage')) {
        config.operations.erc20.burn_percentage = answers.erc20_burn_percentage;
      }
      if (answers.hasOwnProperty('erc20_decimals')) {
        config.operations.erc20.decimals = answers.erc20_decimals;
      }
    }
    
    // NFT configuration
    if (answers.enabledOperations.includes('nft')) {
      if (answers.hasOwnProperty('nft_mint_min') && 
          answers.hasOwnProperty('nft_mint_max')) {
        config.operations.nft.mint_count = {
          min: answers.nft_mint_min,
          max: answers.nft_mint_max
        };
      }
      if (answers.hasOwnProperty('nft_burn_percentage')) {
        config.operations.nft.burn_percentage = answers.nft_burn_percentage;
      }
      if (answers.hasOwnProperty('nft_supply_min') && 
          answers.hasOwnProperty('nft_supply_max')) {
        config.operations.nft.supply = {
          min: answers.nft_supply_min,
          max: answers.nft_supply_max
        };
      }
    }
    
    // Proxy settings
    config.proxy.enabled = answers.enableProxy;
    if (answers.enableProxy) {
      config.proxy.type = answers.proxyType;
      config.proxy.rotation.enabled = answers.enableProxyRotation;
      if (answers.hasOwnProperty('proxyRotationPerOperation')) {
        config.proxy.rotation.per_operation = answers.proxyRotationPerOperation;
      }
    }
    
    // Randomization
    config.randomization.enable = answers.enableRandomization;
    if (answers.enableRandomization) {
      config.randomization.excluded_operations = answers.randomizationExcluded;
    }
    
    return config;
  }

  /**
   * Save configuration to file
   * @returns {Promise<void>}
   */
  async save() {
    try {
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      this.logger.success(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Set current wallet number for contextual operations
   * @param {Number|null} num Wallet number
   * @returns {ConfigManager} This instance for chaining
   */
  setWalletNum(num) {
    this.walletNum = num;
    this.logger = logger.getInstance(num);
    return this;
  }

  /**
   * Get configuration value by path with optional default
   * @param {string} path Configuration object path
   * @param {*} defaultValue Default value if path not found
   * @returns {*} Configuration value
   */
  get(path, defaultValue) {
    return _.get(this.config, path, defaultValue);
  }

  /**
   * Get numeric configuration value
   * @param {string} path Configuration object path
   * @param {number} defaultValue Default value if path not found
   * @returns {number} Configuration value as number
   */
  getNumber(path, defaultValue = 0) {
    return Number(this.get(path, defaultValue));
  }

  /**
   * Get boolean configuration value
   * @param {string} path Configuration object path
   * @param {boolean} defaultValue Default value if path not found
   * @returns {boolean} Configuration value as boolean
   */
  getBoolean(path, defaultValue = false) {
    return Boolean(this.get(path, defaultValue));
  }

  /**
   * Get string configuration value
   * @param {string} path Configuration object path
   * @param {string} defaultValue Default value if path not found
   * @returns {string} Configuration value as string
   */
  getString(path, defaultValue = '') {
    return String(this.get(path, defaultValue));
  }

  /**
   * Get array configuration value
   * @param {string} path Configuration object path
   * @param {Array} defaultValue Default value if path not found
   * @returns {Array} Configuration value as array
   */
  getArray(path, defaultValue = []) {
    const value = this.get(path, defaultValue);
    return Array.isArray(value) ? value : defaultValue;
  }

  /**
   * Check if feature is enabled
   * @param {string} feature Feature name
   * @returns {boolean} Whether feature is enabled
   */
  isEnabled(feature) {
    return this.getBoolean(`operations.${feature}.enabled`, false);
  }

  /**
   * Get configured number range
   * @param {string} feature Feature name
   * @param {string} property Property name
   * @param {number} defaultMin Default minimum
   * @param {number} defaultMax Default maximum
   * @returns {Object} Range with min and max properties
   */
  getRange(feature, property, defaultMin = 1, defaultMax = 10) {
    const minValue = this.getNumber(`operations.${feature}.${property}.min`, defaultMin);
    let maxValue = this.getNumber(`operations.${feature}.${property}.max`, defaultMax);
    
    if (minValue > maxValue) {
      this.logger.warn(`Invalid range for ${feature}.${property}: min (${minValue}) > max (${maxValue}). Using min value.`);
      maxValue = minValue;
    }
    
    return { min: minValue, max: maxValue };
  }

  /**
   * Get random value within configured range
   * @param {string} feature Feature name
   * @param {string} property Property name
   * @param {number} defaultMin Default minimum
   * @param {number} defaultMax Default maximum
   * @returns {number} Random value in range
   */
  getRandomInRange(feature, property, defaultMin = 1, defaultMax = 10) {
    const range = this.getRange(feature, property, defaultMin, defaultMax);
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }

  /**
   * Get delay configuration
   * @returns {Object} Delay configuration with min_seconds and max_seconds
   */
  getDelayConfig() {
    return this.config.general?.delay || 
           { min_seconds: 5, max_seconds: 30 };
  }

  /**
   * Get repeat times for a feature
   * @param {string} feature Feature name
   * @param {number} defaultValue Default value
   * @returns {number} Number of repetitions
   */
  getRepeatTimes(feature, defaultValue = 1) {
    return this.getNumber(`operations.${feature}.repeat_times`, defaultValue);
  }

  /**
   * Get gas price multiplier
   * @returns {number} Multiplier value
   */
  getGasPriceMultiplier() {
    return this.getNumber('general.gas_price_multiplier', 1.2);
  }

  /**
   * Set configuration value
   * @param {string} path Configuration path
   * @param {*} value Value to set
   * @returns {ConfigManager} This instance for chaining
   */
  set(path, value) {
    _.set(this.config, path, value);
    return this;
  }

  /**
   * Get randomized operation order
   * @param {Array} allOperations All available operations
   * @returns {Array} Operations in randomized order according to config
   */
  getRandomizedOperations(allOperations) {
    const randomizationConfig = this.get('randomization', { 
      enable: false, 
      excluded_operations: [],
      operations_to_run: allOperations.map(op => op.name)
    });
    
    const operationsToRun = randomizationConfig.operations_to_run || 
                            allOperations.map(op => op.name);
    
    const filteredOperations = allOperations.filter(op => 
      operationsToRun.includes(op.name));
    
    const excludedOps = randomizationConfig.excluded_operations || [];
    const fixedOps = filteredOperations.filter(op => 
      excludedOps.includes(op.name));
    const randomizableOps = filteredOperations.filter(op => 
      !excludedOps.includes(op.name));
    
    if (randomizationConfig.enable && randomizableOps.length > 1) {
      this.shuffleArray(randomizableOps);
    }
    
    return [...fixedOps, ...randomizableOps];
  }

  /**
   * Shuffle array in-place
   * @param {Array} array Array to shuffle
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

// Export singleton instance
module.exports = new ConfigManager();