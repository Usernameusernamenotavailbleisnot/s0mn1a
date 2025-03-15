#!/usr/bin/env node
/**
 * s0mn1a Testnet Automation
 * Main application entry point
 */
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const logger = require('./utils/logger');
const banner = require('./utils/banner');
const config = require('./config');
const { handleError } = require('./utils/error');
const { wait } = require('./utils/delay');
const OperationRegistry = require('./commands');
const ProxyManager = require('./core/proxy');

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
  process.exit(1);
});

/**
 * Initialize the data directory structure
 * @returns {Promise<void>}
 */
async function initializeDataDir() {
  try {
    await fs.mkdir('data', { recursive: true });
    logger.info('Data directory initialized');
  } catch (error) {
    throw new Error(`Failed to initialize data directory: ${error.message}`);
  }
}

/**
 * Load private keys from file
 * @returns {Promise<Array<string>>} Array of private keys
 */
async function loadPrivateKeys() {
  try {
    // Ensure data directory exists
    await fs.mkdir('data', { recursive: true });
    
    // Try to read pk.txt
    try {
      const pkFile = await fs.readFile('data/pk.txt', 'utf8');
      const privateKeys = pkFile.split('\n')
        .map(line => line.trim())
        .filter(line => line);
      
      if (privateKeys.length === 0) {
        throw new Error('No private keys found in pk.txt');
      }
      
      logger.success(`Loaded ${privateKeys.length} private keys`);
      return privateKeys;
    } catch (err) {
      // Create empty file if not exists
      if (err.code === 'ENOENT') {
        logger.error('data/pk.txt not found, creating empty file');
        await fs.writeFile('data/pk.txt', '', 'utf8');
        logger.error('Please add private keys to data/pk.txt, one per line');
        process.exit(1);
      } else {
        throw err;
      }
    }
  } catch (error) {
    logger.error(`Error loading private keys: ${error.message}`);
    throw new Error('Unable to load private keys. Make sure data/pk.txt exists and contains valid keys.');
  }
}

/**
 * Run a countdown timer with visual feedback
 * @param {number} hours Hours to count down
 * @returns {Promise<void>}
 */
async function countdownTimer(hours = 8) {
  const totalSeconds = hours * 3600;
  let remainingSeconds = totalSeconds;
  
  logger.setWalletNum(null);
  const countdownLogger = logger.getInstance();

  while (remainingSeconds > 0) {
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      chalk.blue(`${countdownLogger.getTimestamp()} Next cycle in: `) + 
      chalk.yellow(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
    );

    await wait(1000);
    remainingSeconds--;
  }

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  countdownLogger.success(`Countdown completed!`);
}

/**
 * Run the automation process
 * @returns {Promise<void>}
 */
async function runAutomation() {
  while (true) {
    try {
      // Display banner
      banner.showBanner();
      
      // Load and validate configuration, always use interactive mode
      await config.load(true);
      
      // Initialize proxy manager
      const proxyManager = ProxyManager.getInstance();
      await proxyManager.initialize(config);
      
      // Load private keys
      const privateKeys = await loadPrivateKeys();
      const walletCount = privateKeys.length;
      
      // Process each wallet
      logger.success(`Found ${walletCount} private keys`);
      logger.info(`Initializing automation...`);
      logger.header(`Processing ${walletCount} wallets...`);
      
      for (let i = 0; i < walletCount; i++) {
        const walletNum = i + 1;
        const privateKey = privateKeys[i];
        
        logger.setWalletNum(walletNum);
        const walletLogger = logger.getInstance(walletNum);
        
        console.log(''); // Add newline for readability
        walletLogger.header(`Processing Wallet ${walletNum}/${walletCount}`);
        
        // Initialize operation registry for this wallet
        const registry = new OperationRegistry(privateKey, config, walletNum);
        await registry.executeOperations();
        
        // Wait between wallets if not the last one
        if (i < walletCount - 1) {
          const waitTime = Math.floor(Math.random() * 11) + 5; // 5-15 seconds
          walletLogger.warn(`Waiting ${waitTime} seconds before next wallet...`);
          await wait(waitTime * 1000);
        }
      }
      
      // Reset to global logger for completion message
      logger.setWalletNum(null);
      logger.header('Wallet processing completed! Starting 8-hour countdown...');
      
      // Start the countdown timer
      await countdownTimer(8);
      
    } catch (error) {
      handleError(error, 'Application error');
      process.exit(1);
    }
  }
}

/**
 * Main function to run the application
 */
async function main() {
  try {
    await initializeDataDir();
    await runAutomation();
  } catch (error) {
    handleError(error, 'Fatal error');
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    handleError(error, 'Unhandled error in main');
    process.exit(1);
  });
}

module.exports = { main, runAutomation };