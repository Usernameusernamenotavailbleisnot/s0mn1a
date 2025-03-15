/**
 * ASCII banner generation
 * Creates visual elements for CLI interface
 */
const figlet = require('figlet');
const chalk = require('chalk');
const logger = require('./logger');
const constants = require('./constants');

/**
 * Generate an ASCII art banner with shadow effect
 * @param {string} text Banner text
 * @returns {string} Generated banner
 */
function generateBanner(text = 's0mn1a') {
  try {
    // Generate ASCII art text
    const figletText = figlet.textSync(text, {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 120
    });
    
    // Add color
    const coloredText = chalk.cyan(figletText);
    
    // Create border
    const width = Math.max(...figletText.split('\n').map(line => line.length));
    const border = chalk.blue('═'.repeat(width));
    
    // Add timestamp and version info
    const timestamp = logger.getInstance().getTimestamp();
    const version = constants.VERSION.APP;
    
    return `\n${border}\n${coloredText}\n${border}\n${chalk.blue(timestamp)} ${chalk.white.bold(`Testnet Automation v${version}`)}\n`;
  } catch (error) {
    // Fallback if figlet fails
    console.error(`Error generating banner: ${error.message}`);
    return `\n${chalk.cyan.bold('===== s0mn1a Testnet Automation Tool =====')}\n`;
  }
}

/**
 * Display banner on console
 */
function showBanner() {
  console.log(generateBanner());
}

/**
 * Generate completion banner
 * @param {string} message Completion message
 * @returns {string} Generated banner
 */
function generateCompletionBanner(message = 'Automation Completed') {
  try {
    const figletText = figlet.textSync(message, {
      font: 'Small',
      horizontalLayout: 'default',
      verticalLayout: 'default',
      width: 80
    });
    
    const coloredText = chalk.green(figletText);
    const width = Math.max(...figletText.split('\n').map(line => line.length));
    const border = chalk.green('='.repeat(width));
    const timestamp = logger.getInstance().getTimestamp();
    
    return `\n${border}\n${coloredText}\n${border}\n${chalk.green(timestamp)} ${chalk.white.bold('Process finished successfully')}\n`;
  } catch (error) {
    return `\n${chalk.green.bold('===== Automation Completed Successfully =====')}\n`;
  }
}

/**
 * Display completion banner
 * @param {string} message Completion message
 */
function showCompletionBanner(message) {
  console.log(generateCompletionBanner(message));
}

module.exports = {
  generateBanner,
  showBanner,
  generateCompletionBanner,
  showCompletionBanner
};