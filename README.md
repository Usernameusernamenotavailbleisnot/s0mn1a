# s0mn1a Testnet Automation 
A comprehensive, modular automation tool for interacting with the s0mn1a Testnet environment. This tool helps automate various blockchain operations to simplify testing and development workflows.

## Features

- **Multi-wallet support**: Process multiple wallets in sequence
- **Automatic faucet**: Claim native tokens from the s0mn1a faucet
- **Token swapping**: Swap between PING and PONG tokens on s0mn1a
- **Memcoin trading**: Trade various memcoins on the network
- **ETH transfers**: Automated self-transfers with configurable amounts
- **Token operations**: Create and manage ERC20 tokens and NFT collections
- **Interactive configuration**: TUI-based configuration setup using Inquirer.js
- **Proxy support**: Use HTTP or SOCKS5 proxies for connections
- **Operation randomization**: Randomize operations for more realistic testing
- **Extensive logging**: Detailed logs for monitoring and debugging
- **Intelligent retry**: Automatic retry for failed transactions with gas adjustment

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/Usernameusernamenotavailbleisnot/s0mn1a.git
   cd s0mn1a
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up your private keys:
   - Create a `data` directory in the project root if it doesn't exist
   - Create a file named `pk.txt` in the `data` directory
   - Add one private key per line (without the '0x' prefix)

4. (Optional) Set up proxies:
   - Create a file named `proxy.txt` in the `data` directory
   - Add one proxy per line in the format `ip:port` or `username:password@ip:port`
   - Proxies are useful for faucet operations to avoid rate limits

## Configuration

Every time you run the tool, it will present an interactive configuration setup that lets you:

- Choose which operations to enable
- Configure gas price settings
- Configure detailed settings for each operation
- Set up proxy support if needed
- Enable operation randomization
- And more...

The configuration is stored in `config.json` in the project root and can be edited manually if needed.

## Usage

Start the automation process:

```
npm start
```

The tool will:
1. Present interactive configuration setup
2. Initialize proxy settings if enabled
3. Process each wallet sequentially, performing the enabled operations
4. Wait 8 hours before starting the next cycle

## Available Operations

### Faucet
Automatically claims native tokens from the s0mn1a faucet for each wallet. Handles rate limits intelligently.

### TokenSwap
Mints PING and PONG tokens and swaps between them using the s0mn1a testnet router. Features:
- Configurable minting
- Percentage-based or fixed amount swapping
- Intelligent allowance checking
- Configurable slippage

### MemCoin
Trades various memcoins on the network, including buying and selling with configurable amounts.

### Transfer
Performs self-transfers of STT (s0mn1a TestToken) with either fixed amounts or percentage-based amounts.

### ERC20
Creates custom ERC20 tokens with mint and burn operations.

### NFT
Creates NFT collections with mint and burn capabilities.

## Project Structure

```
/s0mn1a-automation
├── src                    # Core application logic
│   ├── commands           # CLI commands and operation handlers
│   │   ├── erc20.js       # ERC20 token operations
│   │   ├── faucet.js      # Faucet claiming operations
│   │   ├── index.js       # Command registry
│   │   ├── memcoin.js     # Memcoin operations
│   │   ├── nft.js         # NFT operations
│   │   ├── tokenswap.js   # Token swap operations
│   │   └── transfer.js    # ETH transfer operations
│   ├── config             # Configuration handling
│   │   ├── default.js     # Default configuration values
│   │   ├── index.js       # Configuration manager
│   │   ├── inquirer.js    # Interactive configuration prompts
│   │   └── schema.js      # Configuration schema validation
│   ├── core               # Core functionality
│   │   ├── blockchain.js  # Blockchain interaction manager
│   │   ├── contract.js    # Smart contract interactions
│   │   ├── operation.js   # Base operation class
│   │   └── proxy.js       # Proxy management
│   ├── utils              # Utility functions
│   │   ├── banner.js      # CLI banner display
│   │   ├── constants.js   # Application constants
│   │   ├── delay.js       # Operation timing utilities
│   │   ├── error.js       # Error handling utilities
│   │   └── logger.js      # Logging functionality
│   └── index.js           # Main application entry point
```

## Proxy Support

The tool supports both HTTP and SOCKS5 proxies for operations that require network requests, such as faucet claims. Proxy rotation can be enabled to distribute requests across multiple proxies.

## Retry Mechanism

The application includes a sophisticated retry system for handling transaction failures:
- Automatic retry of failed transactions
- Increasing gas price on each retry
- Intelligent error detection
- Configurable retry count and delays

## Logs

Logs are displayed in the console with color-coding for different types of messages:
- ✓ Success messages (green)
- ℹ Info messages (cyan)
- ⚠ Warning messages (yellow)
- ✗ Error messages (red)

## Advanced Configuration

While the interactive setup covers the most common settings, you can manually edit `config.json` to fine-tune specific parameters:
- Custom delay ranges
- Per-operation retry settings
- Gas price adjustments
- Token amounts and percentages

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is for educational and testing purposes only. Please use responsibly and in accordance with the terms of service of the networks you interact with.
