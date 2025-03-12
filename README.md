# s0mn1a Testnet Automation

A comprehensive automation tool for interacting with the s0mn1a Testnet environment. This tool helps automate various blockchain operations to simplify testing and development workflows.

## Features

- **Multi-wallet support**: Process multiple wallets in sequence
- **Automatic faucet**: Claim native tokens from the s0mn1a faucet
- **Token swaps**: Swap between PING and PONG tokens on s0mn1a
- **ETH transfers**: Automated self-transfers with configurable amounts
- **Smart contract deployment**: Deploy and interact with various smart contracts
- **Token operations**: Create and manage ERC20 tokens and NFT collections
- **Contract testing**: Run test sequences against deployed contracts
- **Batch operations**: Execute multiple operations in a single transaction
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

The tool is configured using `config.json` in the project root. A default configuration will be created if it doesn't exist.

Key configuration options:

```json
{
  "operations": {
    "faucet": {
      "enabled": true,
      "retry": {
        "max_attempts": 3,
        "delay_ms": 5000
      }
    },
    "tokenswap": {
      "enabled": true,
      "mint": { "enabled": true },
      "swap": { "enabled": true },
      "slippage": 500,
      "repeat_times": 1
    },
    "transfer": {
      "enabled": true,
      "use_percentage": false,
      "fixed_amount": {
        "min": 0.001,
        "max": 0.002
      },
      "repeat_times": 2
    },
    "contract_deploy": { "enabled": true },
    "contract_testing": { "enabled": true },
    "erc20": { "enabled": true },
    "nft": { "enabled": true },
    "batch_operations": { "enabled": true }
  },
  "general": {
    "gas_price_multiplier": 1.05,
    "max_retries": 1,
    "log_level": "info"
  },
  "proxy": {
    "enabled": true,
    "type": "http",
    "rotation": { "enabled": true }
  },
  "randomization": {
    "enable": true,
    "excluded_operations": ["faucet"]
  }
}
```

## Usage

Start the automation process:

```
npm start
```

The tool will:
1. Load configuration and private keys
2. Initialize proxy settings if enabled
3. Process each wallet sequentially, performing the enabled operations
4. Wait 8 hours before starting the next cycle

## Operation Details

### Faucet
Automatically claims native tokens from the s0mn1a faucet for each wallet. Handles rate limits intelligently.

### Token Swap
Mints PING and PONG tokens and swaps between them using the s0mn1a testnet router. Features:
- Configurable minting
- Percentage-based or fixed amount swapping
- Intelligent allowance checking to avoid unnecessary approvals
- Configurable slippage

### Transfer
Performs self-transfers of STT (s0mn1a TestToken) with either fixed amounts or percentage-based amounts.

### Contract Deploy
Deploys sample contracts with automated interaction sequences.

### Contract Testing
Tests deployed contracts with various parameter values and operation sequences.

### ERC20
Creates custom ERC20 tokens with mint and burn operations.

### NFT
Creates NFT collections with mint and burn capabilities.

### Batch Operations
Executes multiple operations in a single transaction for efficiency.

## Retry Mechanism

The application includes a sophisticated retry system for handling transaction failures:
- Automatic retry of failed transactions
- Increasing gas price on each retry
- Intelligent error detection to determine if an error is retryable
- Configurable retry count and delays

## Logs

Logs are saved to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is for educational and testing purposes only. Please use responsibly and in accordance with the terms of service of the networks you interact with.
