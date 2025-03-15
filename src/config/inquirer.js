/**
 * Interactive configuration prompts using Inquirer.js
 */

// Available operations for user selection
const availableOperations = [
    { name: 'Faucet: Claim testnet tokens', value: 'faucet' },
    { name: 'TokenSwap: Swap PING/PONG tokens', value: 'tokenswap' },
    { name: 'MemCoin: Trade memcoins', value: 'memcoin' },
    { name: 'Transfer: Self-transfer ETH', value: 'transfer' },
    { name: 'ERC20: Create & manage tokens', value: 'erc20' },
    { name: 'NFT: Create & manage NFTs', value: 'nft' },
  ];
  
  /**
   * Generate configuration prompts with existing config as defaults
   * @param {Object} config Existing configuration
   * @returns {Array} Inquirer prompts
   */
  const configPrompts = (config = {}) => [
    // General welcome
    {
      type: 'message',
      name: 'welcome',
      message: '🚀 Welcome to s0mn1a Testnet Automation Configuration',
    },
    
    // Operation selection
    {
      type: 'checkbox',
      name: 'enabledOperations',
      message: 'Select operations to enable:',
      choices: availableOperations,
      default: () => {
        // Use operations that are already enabled in config
        if (config.operations) {
          return availableOperations
            .filter(op => config.operations[op.value]?.enabled)
            .map(op => op.value);
        }
        return ['faucet', 'tokenswap', 'transfer'];
      },
      validate: (answer) => {
        if (answer.length < 1) {
          return 'You must select at least one operation';
        }
        return true;
      }
    },
    
    // GENERAL SETTINGS
    {
      type: 'number',
      name: 'gasPriceMultiplier',
      message: 'Gas price multiplier (1.0-2.0):',
      default: () => config.general?.gas_price_multiplier || 1.2,
      validate: (value) => {
        if (isNaN(value) || value < 1.0 || value > 2.0) {
          return 'Please enter a number between 1.0 and 2.0';
        }
        return true;
      }
    },
    {
      type: 'number',
      name: 'maxRetries',
      message: 'Maximum retries for failed transactions:',
      default: () => config.general?.max_retries || 3
    },
    {
      type: 'number',
      name: 'delayMinSeconds',
      message: 'Minimum delay between operations (seconds):',
      default: () => config.general?.delay?.min_seconds || 3
    },
    {
      type: 'number',
      name: 'delayMaxSeconds',
      message: 'Maximum delay between operations (seconds):',
      default: () => config.general?.delay?.max_seconds || 10
    },
    
    // FAUCET SETTINGS
    {
      type: 'number',
      name: 'faucet_max_attempts',
      message: 'Faucet maximum retry attempts:',
      default: () => config.operations?.faucet?.retry?.max_attempts || 3,
      when: (answers) => answers.enabledOperations.includes('faucet')
    },
    {
      type: 'number',
      name: 'faucet_delay_ms',
      message: 'Faucet retry delay (milliseconds):',
      default: () => config.operations?.faucet?.retry?.delay_ms || 5000,
      when: (answers) => answers.enabledOperations.includes('faucet')
    },
    
    // TOKENSWAP SETTINGS
    {
      type: 'confirm',
      name: 'tokenswap_mint_enabled',
      message: 'Enable token minting for TokenSwap?',
      default: () => config.operations?.tokenswap?.mint?.enabled !== false,
      when: (answers) => answers.enabledOperations.includes('tokenswap')
    },
    {
      type: 'number',
      name: 'tokenswap_mint_amount',
      message: 'Token mint amount for TokenSwap:',
      default: () => config.operations?.tokenswap?.mint?.amount || 1000,
      when: (answers) => answers.enabledOperations.includes('tokenswap') && answers.tokenswap_mint_enabled
    },
    {
      type: 'confirm',
      name: 'tokenswap_swap_enabled',
      message: 'Enable token swapping for TokenSwap?',
      default: () => config.operations?.tokenswap?.swap?.enabled !== false,
      when: (answers) => answers.enabledOperations.includes('tokenswap')
    },
    {
      type: 'confirm',
      name: 'tokenswap_use_percentage',
      message: 'Use percentage-based amount for TokenSwap?',
      default: () => config.operations?.tokenswap?.swap?.use_percentage !== false,
      when: (answers) => answers.enabledOperations.includes('tokenswap') && answers.tokenswap_swap_enabled
    },
    {
      type: 'number',
      name: 'tokenswap_percentage',
      message: 'Percentage to swap:',
      default: () => config.operations?.tokenswap?.swap?.percentage || 10,
      when: (answers) => answers.enabledOperations.includes('tokenswap') && answers.tokenswap_swap_enabled && answers.tokenswap_use_percentage
    },
    {
      type: 'number',
      name: 'tokenswap_fixed_min',
      message: 'Minimum fixed swap amount:',
      default: () => config.operations?.tokenswap?.swap?.fixed_amount?.min || 0.5,
      when: (answers) => answers.enabledOperations.includes('tokenswap') && answers.tokenswap_swap_enabled && !answers.tokenswap_use_percentage
    },
    {
      type: 'number',
      name: 'tokenswap_fixed_max',
      message: 'Maximum fixed swap amount:',
      default: () => config.operations?.tokenswap?.swap?.fixed_amount?.max || 5,
      when: (answers) => answers.enabledOperations.includes('tokenswap') && answers.tokenswap_swap_enabled && !answers.tokenswap_use_percentage
    },
    {
      type: 'number',
      name: 'tokenswap_fixed_decimals',
      message: 'Decimal precision for fixed swap amount:',
      default: () => config.operations?.tokenswap?.swap?.fixed_amount?.decimals || 2,
      when: (answers) => answers.enabledOperations.includes('tokenswap') && answers.tokenswap_swap_enabled && !answers.tokenswap_use_percentage
    },
    {
      type: 'number',
      name: 'tokenswap_slippage',
      message: 'Slippage tolerance in basis points (100 = 1%):',
      default: () => config.operations?.tokenswap?.slippage || 500,
      when: (answers) => answers.enabledOperations.includes('tokenswap') && answers.tokenswap_swap_enabled
    },
    {
      type: 'number',
      name: 'tokenswap_repeat_times',
      message: 'Number of times to repeat TokenSwap operations:',
      default: () => config.operations?.tokenswap?.repeat_times || 1,
      when: (answers) => answers.enabledOperations.includes('tokenswap')
    },
    {
      type: 'number',
      name: 'tokenswap_retry_attempts',
      message: 'TokenSwap maximum retry attempts:',
      default: () => config.operations?.tokenswap?.retry?.max_attempts || 3,
      when: (answers) => answers.enabledOperations.includes('tokenswap')
    },
    {
      type: 'number',
      name: 'tokenswap_retry_delay',
      message: 'TokenSwap retry delay (milliseconds):',
      default: () => config.operations?.tokenswap?.retry?.delay_ms || 2000,
      when: (answers) => answers.enabledOperations.includes('tokenswap')
    },
    {
      type: 'number',
      name: 'tokenswap_gas_increase',
      message: 'TokenSwap gas increase factor for retries:',
      default: () => config.operations?.tokenswap?.retry?.gas_increase || 1.2,
      when: (answers) => answers.enabledOperations.includes('tokenswap')
    },
    
    // MEMCOIN SETTINGS
    {
      type: 'confirm',
      name: 'memcoin_mint_enabled',
      message: 'Enable memcoin minting?',
      default: () => config.operations?.memcoin?.mint_enabled !== false,
      when: (answers) => answers.enabledOperations.includes('memcoin')
    },
    {
      type: 'number',
      name: 'memcoin_buy_amount',
      message: 'Memcoin buy amount:',
      default: () => config.operations?.memcoin?.buy_amount || 0.1,
      when: (answers) => answers.enabledOperations.includes('memcoin')
    },
    {
      type: 'number',
      name: 'memcoin_sell_amount',
      message: 'Memcoin sell amount:',
      default: () => config.operations?.memcoin?.sell_amount || 0.01,
      when: (answers) => answers.enabledOperations.includes('memcoin')
    },
    {
      type: 'number',
      name: 'memcoin_slippage',
      message: 'Memcoin slippage tolerance (basis points):',
      default: () => config.operations?.memcoin?.slippage || 500,
      when: (answers) => answers.enabledOperations.includes('memcoin')
    },
    {
      type: 'number',
      name: 'memcoin_repeat_times',
      message: 'Number of times to repeat Memcoin operations:',
      default: () => config.operations?.memcoin?.repeat_times || 1,
      when: (answers) => answers.enabledOperations.includes('memcoin')
    },
    
    // TRANSFER SETTINGS
    {
      type: 'confirm',
      name: 'transfer_use_percentage',
      message: 'Use percentage-based amount for Transfers?',
      default: () => config.operations?.transfer?.use_percentage !== false,
      when: (answers) => answers.enabledOperations.includes('transfer')
    },
    {
      type: 'number',
      name: 'transfer_percentage',
      message: 'Percentage of balance to transfer:',
      default: () => config.operations?.transfer?.percentage || 90,
      when: (answers) => answers.enabledOperations.includes('transfer') && answers.transfer_use_percentage
    },
    {
      type: 'number',
      name: 'transfer_fixed_min',
      message: 'Minimum fixed transfer amount:',
      default: () => config.operations?.transfer?.fixed_amount?.min || 0.0001,
      when: (answers) => answers.enabledOperations.includes('transfer') && !answers.transfer_use_percentage
    },
    {
      type: 'number',
      name: 'transfer_fixed_max',
      message: 'Maximum fixed transfer amount:',
      default: () => config.operations?.transfer?.fixed_amount?.max || 0.001,
      when: (answers) => answers.enabledOperations.includes('transfer') && !answers.transfer_use_percentage
    },
    {
      type: 'number',
      name: 'transfer_fixed_decimals',
      message: 'Decimal precision for fixed transfer amount:',
      default: () => config.operations?.transfer?.fixed_amount?.decimals || 5,
      when: (answers) => answers.enabledOperations.includes('transfer') && !answers.transfer_use_percentage
    },
    {
      type: 'number',
      name: 'transfer_count_min',
      message: 'Minimum number of transfers per cycle:',
      default: () => config.operations?.transfer?.count?.min || 1,
      when: (answers) => answers.enabledOperations.includes('transfer')
    },
    {
      type: 'number',
      name: 'transfer_count_max',
      message: 'Maximum number of transfers per cycle:',
      default: () => config.operations?.transfer?.count?.max || 3,
      when: (answers) => answers.enabledOperations.includes('transfer')
    },
    {
      type: 'number',
      name: 'transfer_repeat_times',
      message: 'Number of times to repeat Transfer operations:',
      default: () => config.operations?.transfer?.repeat_times || 2,
      when: (answers) => answers.enabledOperations.includes('transfer')
    },
    
    // ERC20 SETTINGS
    {
      type: 'number',
      name: 'erc20_mint_min',
      message: 'Minimum ERC20 token mint amount:',
      default: () => config.operations?.erc20?.mint_amount?.min || 1000000,
      when: (answers) => answers.enabledOperations.includes('erc20')
    },
    {
      type: 'number',
      name: 'erc20_mint_max',
      message: 'Maximum ERC20 token mint amount:',
      default: () => config.operations?.erc20?.mint_amount?.max || 10000000,
      when: (answers) => answers.enabledOperations.includes('erc20')
    },
    {
      type: 'number',
      name: 'erc20_burn_percentage',
      message: 'ERC20 token burn percentage:',
      default: () => config.operations?.erc20?.burn_percentage || 10,
      when: (answers) => answers.enabledOperations.includes('erc20')
    },
    {
      type: 'number',
      name: 'erc20_decimals',
      message: 'ERC20 token decimals:',
      default: () => config.operations?.erc20?.decimals || 18,
      when: (answers) => answers.enabledOperations.includes('erc20')
    },
    
    // NFT SETTINGS
    {
      type: 'number',
      name: 'nft_mint_min',
      message: 'Minimum NFTs to mint:',
      default: () => config.operations?.nft?.mint_count?.min || 2,
      when: (answers) => answers.enabledOperations.includes('nft')
    },
    {
      type: 'number',
      name: 'nft_mint_max',
      message: 'Maximum NFTs to mint:',
      default: () => config.operations?.nft?.mint_count?.max || 5,
      when: (answers) => answers.enabledOperations.includes('nft')
    },
    {
      type: 'number',
      name: 'nft_burn_percentage',
      message: 'NFT burn percentage:',
      default: () => config.operations?.nft?.burn_percentage || 20,
      when: (answers) => answers.enabledOperations.includes('nft')
    },
    {
      type: 'number',
      name: 'nft_supply_min',
      message: 'Minimum NFT collection supply:',
      default: () => config.operations?.nft?.supply?.min || 100,
      when: (answers) => answers.enabledOperations.includes('nft')
    },
    {
      type: 'number',
      name: 'nft_supply_max',
      message: 'Maximum NFT collection supply:',
      default: () => config.operations?.nft?.supply?.max || 500,
      when: (answers) => answers.enabledOperations.includes('nft')
    },
    
    // PROXY SETTINGS
    {
      type: 'confirm',
      name: 'enableProxy',
      message: 'Enable proxy support?',
      default: () => config.proxy?.enabled || false
    },
    {
      type: 'list',
      name: 'proxyType',
      message: 'Select proxy type:',
      choices: [
        { name: 'HTTP/HTTPS', value: 'http' },
        { name: 'SOCKS5', value: 'socks5' }
      ],
      default: () => config.proxy?.type || 'http',
      when: (answers) => answers.enableProxy
    },
    {
      type: 'confirm',
      name: 'enableProxyRotation',
      message: 'Enable proxy rotation?',
      default: () => config.proxy?.rotation?.enabled || true,
      when: (answers) => answers.enableProxy
    },
    {
      type: 'confirm',
      name: 'proxyRotationPerOperation',
      message: 'Rotate proxy per operation?',
      default: () => config.proxy?.rotation?.per_operation || false,
      when: (answers) => answers.enableProxy && answers.enableProxyRotation
    },
    
    // RANDOMIZATION SETTINGS
    {
      type: 'confirm',
      name: 'enableRandomization',
      message: 'Enable operation randomization?',
      default: () => config.randomization?.enable || true
    },
    {
      type: 'checkbox',
      name: 'randomizationExcluded',
      message: 'Select operations to exclude from randomization:',
      choices: availableOperations.map(op => op.value),
      default: () => config.randomization?.excluded_operations || ['faucet'],
      when: (answers) => answers.enableRandomization
    },
    
    // CONFIRMATION
    {
      type: 'confirm',
      name: 'confirmConfig',
      message: 'Save this configuration?',
      default: true
    }
  ];
  
  module.exports = {
    configPrompts,
    availableOperations
  };