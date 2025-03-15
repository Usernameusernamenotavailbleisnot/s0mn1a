/**
 * Application constants
 */
module.exports = {
    // Network information for s0mn1a
    NETWORK: {
      NAME: "s0mn1a Testnet",
      CHAIN_ID: 50312,
      RPC_URL: "https://dream-rpc.somnia.network",
      EXPLORER_URL: "https://shannon-explorer.somnia.network",
      CURRENCY_SYMBOL: "STT"
    },
    
    // Token information for swapping
    TOKEN: {
      // Ping token contract address
      PING_ADDRESS: "0xBeCd9B5F373877881D91cBdBaF013D97eB532154",
      
      // Pong token contract address
      PONG_ADDRESS: "0x7968ac15a72629E05F41B8271e4e7292E0cC9f90",
      
      // Router for swap operations
      ROUTER_ADDRESS: "0x6AAC14f090A35EeA150705f72D90E4CDC4a49b2C",
      
      // Mint function hash for ERC20 tokens
      MINT_FUNCTION: "0x1249c58b",
      
      // Approve function hash for ERC20 tokens
      APPROVE_FUNCTION: "0x095ea7b3",
      
      // Swap function hash for router
      SWAP_FUNCTION: "0x04e45aaf"
    },
    
    // Gas settings
    GAS: {
      PRICE_MULTIPLIER: 1.1,
      RETRY_INCREASE: 1.3,
      MIN_GWEI: 0.0001,
      MAX_GWEI: 200,
      DEFAULT_GAS: 150000,
    },
    
    // Retry settings
    RETRY: {
      MAX_RETRIES: 5,
      BASE_WAIT_TIME: 10,
      RETRY_DELAY_BASE: 5000,
      RETRY_DELAY_EXTRA: 5000,
      MEMPOOL_RETRY_MULTIPLIER: 3
    },
    
    // ERC20 token settings
    ERC20: {
      TOKEN_NAME_PREFIXES: [
        'Moon', 'Doge', 'Shib', 'Pepe', 'Ape', 'Baby', 'Safe', 'Floki', 'Elon', 'Mars',
        'Space', 'Rocket', 'Diamond', 'Crypto', 'Meme', 'Chad', 'Bull', 'Super', 'Mega', 'Meta'
      ],
      TOKEN_NAME_SUFFIXES: [
        'Coin', 'Token', 'Cash', 'Swap', 'Inu', 'Dao', 'Moon', 'Doge', 'Chain', 'Finance',
        'Protocol', 'Network', 'Exchange', 'Capital', 'Money', 'Rocket', 'Rise', 'Gains', 'Pump', 'Whale'
      ],
      CONTRACT_TEMPLATE: `
      // SPDX-License-Identifier: MIT
      pragma solidity >=0.8.0 <0.9.0;
  
      contract {{CONTRACT_NAME}} {
          string public name;
          string public symbol;
          uint8 public decimals;
          uint256 public totalSupply;
          
          address public owner;
          
          mapping(address => uint256) private _balances;
          mapping(address => mapping(address => uint256)) private _allowances;
          
          event Transfer(address indexed from, address indexed to, uint256 value);
          event Approval(address indexed owner, address indexed spender, uint256 value);
          event Mint(address indexed to, uint256 value);
          event Burn(address indexed from, uint256 value);
          
          modifier onlyOwner() {
              require(msg.sender == owner, "Only owner can call this function");
              _;
          }
          
          constructor(string memory _name, string memory _symbol, uint8 _decimals) {
              name = _name;
              symbol = _symbol;
              decimals = _decimals;
              totalSupply = 0;
              owner = msg.sender;
          }
          
          function balanceOf(address account) public view returns (uint256) {
              return _balances[account];
          }
          
          function transfer(address to, uint256 amount) public returns (bool) {
              _transfer(msg.sender, to, amount);
              return true;
          }
          
          function allowance(address owner, address spender) public view returns (uint256) {
              return _allowances[owner][spender];
          }
          
          function approve(address spender, uint256 amount) public returns (bool) {
              _approve(msg.sender, spender, amount);
              return true;
          }
          
          function transferFrom(address from, address to, uint256 amount) public returns (bool) {
              require(_allowances[from][msg.sender] >= amount, "ERC20: insufficient allowance");
              
              _allowances[from][msg.sender] -= amount;
              _transfer(from, to, amount);
              
              return true;
          }
          
          function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
              _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
              return true;
          }
          
          function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
              uint256 currentAllowance = _allowances[msg.sender][spender];
              require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
              
              _approve(msg.sender, spender, currentAllowance - subtractedValue);
              return true;
          }
          
          function mint(address to, uint256 amount) public onlyOwner {
              require(to != address(0), "ERC20: mint to the zero address");
              
              totalSupply += amount;
              _balances[to] += amount;
              
              emit Transfer(address(0), to, amount);
              emit Mint(to, amount);
          }
          
          function burn(uint256 amount) public {
              require(_balances[msg.sender] >= amount, "ERC20: burn amount exceeds balance");
              
              _balances[msg.sender] -= amount;
              totalSupply -= amount;
              
              emit Transfer(msg.sender, address(0), amount);
              emit Burn(msg.sender, amount);
          }
          
          function _transfer(address from, address to, uint256 amount) internal {
              require(from != address(0), "ERC20: transfer from the zero address");
              require(to != address(0), "ERC20: transfer to the zero address");
              require(_balances[from] >= amount, "ERC20: transfer amount exceeds balance");
              
              _balances[from] -= amount;
              _balances[to] += amount;
              
              emit Transfer(from, to, amount);
          }
          
          function _approve(address owner, address spender, uint256 amount) internal {
              require(owner != address(0), "ERC20: approve from the zero address");
              require(spender != address(0), "ERC20: approve to the zero address");
              
              _allowances[owner][spender] = amount;
              
              emit Approval(owner, spender, amount);
          }
      }
      `
    },
    
    // NFT collection settings
    NFT: {
      NAME_PREFIXES: [
        'Crypto', 'Bored', 'Mutant', 'Azuki', 'Doodle', 'Pudgy', 'Cool', 'Lazy', 'Cyber', 'Meta'
      ],
      NAME_SUFFIXES: [
        'Apes', 'Monkeys', 'Punks', 'Cats', 'Dogs', 'Bears', 'Club', 'Society', 'Gang', 'Legends'
      ],
      CONTRACT_TEMPLATE: `
      // SPDX-License-Identifier: MIT
      pragma solidity >=0.8.0 <0.9.0;
  
      contract {{CONTRACT_NAME}} {
          // Contract owner
          address public owner;
          
          // Collection info
          string public name;
          string public symbol;
          uint256 public maxSupply;
          uint256 public totalSupply;
          
          // Token mappings
          mapping(uint256 => address) private _owners;
          mapping(address => uint256) private _balances;
          mapping(uint256 => string) private _tokenURIs;
          
          // Events
          event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
          event Mint(address indexed to, uint256 indexed tokenId, string tokenURI);
          event Burn(address indexed from, uint256 indexed tokenId);
          
          // Modifiers
          modifier onlyOwner() {
              require(msg.sender == owner, "Not the contract owner");
              _;
          }
          
          modifier tokenExists(uint256 tokenId) {
              require(_owners[tokenId] != address(0), "Token doesn't exist");
              _;
          }
          
          constructor(string memory _name, string memory _symbol, uint256 _maxSupply) {
              owner = msg.sender;
              name = _name;
              symbol = _symbol;
              maxSupply = _maxSupply;
              totalSupply = 0;
          }
          
          function mint(address to, uint256 tokenId, string memory tokenURI) public onlyOwner {
              require(to != address(0), "Cannot mint to zero address");
              require(_owners[tokenId] == address(0), "Token already exists");
              require(totalSupply < maxSupply, "Maximum supply reached");
              
              _owners[tokenId] = to;
              _balances[to]++;
              _tokenURIs[tokenId] = tokenURI;
              totalSupply++;
              
              emit Transfer(address(0), to, tokenId);
              emit Mint(to, tokenId, tokenURI);
          }
          
          function burn(uint256 tokenId) public tokenExists(tokenId) {
              address tokenOwner = _owners[tokenId];
              
              // Only token owner or contract owner can burn
              require(msg.sender == tokenOwner || msg.sender == owner, "Not authorized to burn");
              
              // Clear token data
              delete _tokenURIs[tokenId];
              delete _owners[tokenId];
              _balances[tokenOwner]--;
              totalSupply--;
              
              emit Transfer(tokenOwner, address(0), tokenId);
              emit Burn(tokenOwner, tokenId);
          }
          
          function tokenURI(uint256 tokenId) public view tokenExists(tokenId) returns (string memory) {
              return _tokenURIs[tokenId];
          }
          
          function ownerOf(uint256 tokenId) public view tokenExists(tokenId) returns (address) {
              return _owners[tokenId];
          }
          
          function balanceOf(address _owner) public view returns (uint256) {
              require(_owner != address(0), "Zero address has no balance");
              return _balances[_owner];
          }
          
          function tokensOfOwner(address _owner) public view returns (uint256[] memory) {
              uint256 tokenCount = _balances[_owner];
              uint256[] memory tokenIds = new uint256[](tokenCount);
              
              uint256 counter = 0;
              for (uint256 i = 0; i < maxSupply && counter < tokenCount; i++) {
                  if (_owners[i] == _owner) {
                      tokenIds[counter] = i;
                      counter++;
                  }
              }
              
              return tokenIds;
          }
      }
      `
    },
    
    // Faucet information
    FAUCET: {
      URL: "https://testnet.somnia.network/api/faucet",
      ORIGIN: "https://testnet.somnia.network",
      REFERER: "https://testnet.somnia.network/"
    },
    
    // Version information
    VERSION: {
      APP: "2.0.0",
      CONFIG_SCHEMA: "2.0",
      BUILD_DATE: "2025-03-15"
    }
  };