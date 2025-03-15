/**
 * Enhanced logging utility
 * Provides consistent logging with wallet context
 */
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

/**
 * Logger singleton class
 */
class Logger {
  constructor() {
    // Store logger instances by wallet
    this.instances = new Map();
    this._defaultLogger = this._createLogger(null);
    
    // Track last used wallet number
    this._lastWalletNum = null;
    
    // Default log level
    this.logLevel = 'info';
    
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Get logger instance for a specific wallet
   * @param {number|null} walletNum Wallet number
   * @returns {Object} Logger instance
   */
  getInstance(walletNum = null) {
    // Use last wallet number if available
    if (walletNum === null && this._lastWalletNum !== null) {
      walletNum = this._lastWalletNum;
    } else if (walletNum !== null) {
      this._lastWalletNum = walletNum;
    }
    
    if (walletNum === null) {
      return this._defaultLogger;
    }
    
    if (!this.instances.has(walletNum)) {
      this.instances.set(walletNum, this._createLogger(walletNum));
    }
    
    return this.instances.get(walletNum);
  }

  /**
   * Create a new logger instance
   * @param {number|null} walletNum Wallet number
   * @returns {Object} Logger instance
   * @private
   */
  _createLogger(walletNum) {
    const self = this;
    
    return {
      walletNum,
      
      /**
       * Get formatted timestamp
       * @returns {string} Formatted timestamp with wallet context
       */
      getTimestamp() {
        const now = new Date();
        
        // Format date DD/MM/YYYY
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;
        
        // Format time HH:MM:SS
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const formattedTime = `${hours}:${minutes}:${seconds}`;
        
        if (this.walletNum !== null) {
          return `[${formattedDate} - ${formattedTime} - Wallet ${this.walletNum}]`;
        }
        return `[${formattedDate} - ${formattedTime} - System]`;
      },
      
      /**
       * Check if this message level should be logged
       * @param {string} messageLevel Log level to check
       * @returns {boolean} Whether this level should be logged
       */
      shouldLog(messageLevel) {
        const levels = {
          error: 0,
          warn: 1,
          info: 2,
          debug: 3
        };
        
        return levels[messageLevel] <= levels[self.logLevel || 'info'];
      },
      
      /**
       * Log informational message
       * @param {string} message Message content
       */
      info(message) {
        if (this.shouldLog('info')) {
          const formattedMessage = `${this.getTimestamp()} ℹ ${message}`;
          console.log(chalk.cyan(formattedMessage));
        }
      },
      
      /**
       * Log success message
       * @param {string} message Message content
       */
      success(message) {
        if (this.shouldLog('info')) {
          const formattedMessage = `${this.getTimestamp()} ✓ ${message}`;
          console.log(chalk.green(formattedMessage));
        }
      },
      
      /**
       * Log warning message
       * @param {string} message Message content
       */
      warn(message) {
        if (this.shouldLog('warn')) {
          const formattedMessage = `${this.getTimestamp()} ⚠ ${message}`;
          console.log(chalk.yellow(formattedMessage));
        }
      },
      
      /**
       * Log error message
       * @param {string} message Message content
       */
      error(message) {
        if (this.shouldLog('error')) {
          const formattedMessage = `${this.getTimestamp()} ✗ ${message}`;
          console.log(chalk.red(formattedMessage));
        }
      },
      
      /**
       * Log debug message
       * @param {string} message Message content
       */
      debug(message) {
        if (this.shouldLog('debug')) {
          const formattedMessage = `${this.getTimestamp()} 🔍 ${message}`;
          console.log(chalk.gray(formattedMessage));
        }
      },
      
      /**
       * Log header message
       * @param {string} message Message content
       */
      header(message) {
        if (this.shouldLog('info')) {
          // Create divider with width 80 characters
          const divider = chalk.blue("═".repeat(80));
          
          // Display divider, header, and divider
          console.log(`\n${divider}`);
          console.log(chalk.blue.bold(`${this.getTimestamp()} ${message}`));
          console.log(`${divider}\n`);
        }
      },
      
      /**
       * Log message with custom style
       * @param {string} message Message content
       * @param {Function} style Chalk style function
       */
      custom(message, style) {
        if (this.shouldLog('info')) {
          const formattedMessage = `${this.getTimestamp()} ${message}`;
          console.log(style(formattedMessage));
        }
      }
    };
  }

  /**
   * Set log level
   * @param {string} level Log level
   * @returns {Logger} This instance for chaining
   */
  setLogLevel(level) {
    if (['error', 'warn', 'info', 'debug'].includes(level)) {
      this.logLevel = level;
    }
    return this;
  }
  
  /**
   * Set current wallet number
   * @param {number|null} num Wallet number
   * @returns {Object} Logger instance
   */
  setWalletNum(num) {
    this._lastWalletNum = num;
    this.getInstance(num);
    return this.getInstance(num);
  }
  
  /**
   * Get formatted timestamp
   * @returns {string} Current timestamp
   */
  getTimestamp() {
    return this.getInstance().getTimestamp();
  }

  // Proxy methods to the current instance
  info(message) {
    this.getInstance().info(message);
  }
  
  success(message) {
    this.getInstance().success(message);
  }
  
  warn(message) {
    this.getInstance().warn(message);
  }
  
  error(message) {
    this.getInstance().error(message);
  }
  
  debug(message) {
    this.getInstance().debug(message);
  }
  
  header(message) {
    this.getInstance().header(message);
  }
  
  custom(message, style) {
    this.getInstance().custom(message, style);
  }
}

// Export singleton instance
module.exports = new Logger();