/**
 * Error handling utilities
 */
const chalk = require('chalk');
const logger = require('./logger');

/**
 * Handle and format errors
 * @param {Error} error Error object
 * @param {string} context Error context
 * @param {boolean} exit Whether to exit the process
 */
function handleError(error, context = '', exit = false) {
  const log = logger.getInstance();
  
  // Format error message
  const message = error.message || String(error);
  const errorMessage = context ? `${context}: ${message}` : message;
  
  // Log error with stack trace in debug mode
  log.error(errorMessage);
  
  if (log.shouldLog('debug') && error.stack) {
    console.error(chalk.red(error.stack));
  }
  
  // Exit process if required
  if (exit) {
    process.exit(1);
  }
}

/**
 * Execute function with retry logic
 * @param {Function} fn Function to execute
 * @param {Object} options Retry options
 * @returns {Promise<*>} Function result
 */
async function withRetry(fn, options = {}) {
  const { 
    logger: loggerInstance = logger,
    walletNum = null, 
    operationName = 'operation', 
    maxRetries = 3,
    minTimeout = 1000,
    onError = null 
  } = options;
  
  const log = walletNum !== null ? 
    loggerInstance.getInstance(walletNum) : 
    loggerInstance.getInstance();
  
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      log.error(`Error in ${operationName}: ${error.message}`);
      
      if (retries <= maxRetries) {
        // Calculate exponential backoff delay
        const delay = minTimeout * Math.pow(2, retries - 1);
        log.warn(`Attempt ${retries} failed. ${maxRetries - retries + 1} retries left. Waiting ${delay}ms before next attempt.`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        log.error(`All ${maxRetries} retries failed for ${operationName}: ${error.message}`);
        if (onError) return onError(error);
        throw error;
      }
    }
  }
}

/**
 * Wrap object methods with retry logic
 * @param {Object} instance Object instance
 * @param {Array<string>} methodNames Methods to wrap
 * @param {Object} options Retry options
 * @returns {Object} Instance with wrapped methods
 */
function wrapMethodsWithRetry(instance, methodNames, options = {}) {
  const defaults = {
    logger,
    walletNum: instance.walletNum,
    maxRetries: 3,
    minTimeout: 1000
  };
  
  methodNames.forEach(methodName => {
    const originalMethod = instance[methodName];
    if (typeof originalMethod !== 'function') return;
    
    instance[methodName] = async function(...args) {
      const methodOptions = {
        ...defaults,
        ...options,
        operationName: methodName
      };
      
      return withRetry(
        () => originalMethod.apply(instance, args),
        methodOptions
      );
    };
  });
  
  return instance;
}

/**
 * Check if error should be retried based on message
 * @param {string} error Error message
 * @returns {boolean} Whether error is retryable
 */
function isRetryableError(error) {
  // List of error types that should be retried
  const retryableErrors = [
    'nonce',
    'underpriced',
    'timeout',
    'network',
    'gas',
    'rejected',
    'insufficient funds',
    'execution reverted',
    'NONCE_EXPIRED',
    'REPLACEMENT_UNDERPRICED',
    'INSUFFICIENT_FUNDS',
    'UNPREDICTABLE_GAS_LIMIT',
    'TIMEOUT',
    'ETIMEDOUT',
    'NETWORK_ERROR',
    'SERVER_ERROR',
    'CALL_EXCEPTION'
  ];
  
  // Check if any retryable error type is in the error message
  return retryableErrors.some(retryableError => 
    String(error).toLowerCase().includes(retryableError.toLowerCase())
  );
}

module.exports = {
  handleError,
  withRetry,
  wrapMethodsWithRetry,
  isRetryableError
};