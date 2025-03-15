/**
 * Default configuration values
 */
module.exports = {
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
        "mint": {
          "enabled": true,
          "amount": 1000
        },
        "swap": {
          "enabled": true,
          "use_percentage": true,
          "percentage": 10,
          "fixed_amount": {
            "min": 0.5,
            "max": 5,
            "decimals": 2
          }
        },
        "slippage": 500,
        "repeat_times": 1,
        "retry": {
          "max_attempts": 3,
          "delay_ms": 2000,
          "gas_increase": 1.2
        }
      },
      "memcoin": {
        "enabled": true,
        "mint_enabled": true,
        "buy_amount": 1,
        "sell_amount": 0.1,
        "slippage": 500,
        "repeat_times": 1
      },
      "transfer": {
        "enabled": true,
        "use_percentage": true,
        "percentage": 90,
        "fixed_amount": {
          "min": 0.0001,
          "max": 0.001,
          "decimals": 5
        },
        "count": {
          "min": 1,
          "max": 3
        },
        "repeat_times": 2
      },
      "erc20": {
        "enabled": true,
        "mint_amount": {
          "min": 1000000,
          "max": 10000000
        },
        "burn_percentage": 10,
        "decimals": 18
      },
      "nft": {
        "enabled": true,
        "mint_count": {
          "min": 2,
          "max": 5
        },
        "burn_percentage": 20,
        "supply": {
          "min": 100,
          "max": 500
        }
      }
    },
    "general": {
      "gas_price_multiplier": 1.2,
      "max_retries": 3,
      "base_wait_time": 5,
      "delay": {
        "min_seconds": 3,
        "max_seconds": 10
      },
      "log_level": "info"
    },
    "proxy": {
      "enabled": false,
      "type": "http",
      "rotation": {
        "enabled": true,
        "per_operation": false
      }
    },
    "randomization": {
      "enable": true,
      "excluded_operations": ["faucet"],
      "operations_to_run": ["faucet", "memcoin", "tokenswap", "transfer", "erc20", "nft"]
    }
  };