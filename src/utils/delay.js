/**
 * Delay utilities for rate limiting and operation pacing
 */
const chalk = require('chalk');
const logger = require('./logger');

/**
 * Add a random delay between operations
 * @param {Object} config Delay configuration with min_seconds and max_seconds
 * @param {number|null} walletNum Wallet number for logging
 * @param {string} operationName Name of next operation for logging
 * @returns {Promise<boolean>} Success status
 */
async function randomDelay(config, walletNum, operationName = 'next transaction') {
  try {
    // Get logger instance
    const log = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    
    // Extract delay settings
    const delayConfig = extractDelayConfig(config);
    
    // Generate random delay
    const delay = generateDelay(delayConfig.minDelay, delayConfig.maxDelay);
    
    log.custom(`⌛ Waiting ${delay} seconds before ${operationName}...`, chalk.yellow);
    await wait(delay * 1000);
    
    return true;
  } catch (error) {
    const log = walletNum !== null ? logger.getInstance(walletNum) : logger.getInstance();
    log.error(`Error in delay function: ${error.message}`);
    return false;
  }
}

/**
 * Extract delay configuration from various formats
 * @param {Object} config Configuration object in various possible formats
 * @returns {Object} Normalized delay configuration
 */
function extractDelayConfig(config) {
  let minDelay, maxDelay;
  
  if (config.min_seconds !== undefined && config.max_seconds !== undefined) {
    // Direct delay object
    minDelay = config.min_seconds;
    maxDelay = config.max_seconds;
  } else if (config.delay && config.delay.min_seconds !== undefined && config.delay.max_seconds !== undefined) {
    // Config with delay property
    minDelay = config.delay.min_seconds;
    maxDelay = config.delay.max_seconds;
  } else if (config.general && config.general.delay) {
    // Config with general.delay property
    minDelay = config.general.delay.min_seconds;
    maxDelay = config.general.delay.max_seconds;
  } else if (config.get) {
    // Config manager instance
    const delayConfig = config.getDelayConfig();
    minDelay = delayConfig.min_seconds;
    maxDelay = delayConfig.max_seconds;
  } else {
    // Default fallback
    minDelay = 5;
    maxDelay = 30;
  }
  
  return { minDelay, maxDelay };
}

/**
 * Generate a random delay within a range
 * @param {number} min Minimum delay in seconds
 * @param {number} max Maximum delay in seconds
 * @returns {number} Random delay in seconds
 */
function generateDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Promise-based wait function
 * @param {number} ms Milliseconds to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff for retries
 * @param {number} baseDelay Base delay in milliseconds
 * @param {number} retryCount Current retry count
 * @param {number} maxDelay Maximum delay in milliseconds
 * @returns {Promise<number>} Actual delay used in milliseconds
 */
async function exponentialBackoff(baseDelay = 1000, retryCount = 0, maxDelay = 60000) {
  const delay = Math.min(
    Math.floor(baseDelay * Math.pow(1.5, retryCount) + Math.random() * 1000),
    maxDelay
  );
  
  await wait(delay);
  return delay;
}

module.exports = {
  randomDelay,
  wait,
  exponentialBackoff,
  generateDelay,
  extractDelayConfig
};