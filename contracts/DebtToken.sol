// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DebtToken
 * @author TigerPay
 * @notice ERC-20 token representing fractional ownership of merchant debt in a vault.
 * @dev Each MerchantVault deploys its own DebtToken. Tokens can only be transferred
 *      between whitelisted investors. Includes snapshot capability for dividend distribution.
 * 
 * Features:
 * - ERC-20 compliant with transfer restrictions
 * - Investor whitelisting for regulatory compliance
 * - Pausable for emergency stops
 * - Burnable for repayment scenarios
 * - Role-based access control
 * - Lockup period enforcement
 */
contract DebtToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ReentrancyGuard {
    
    // ============ Roles ============
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant WHITELIST_ADMIN_ROLE = keccak256("WHITELIST_ADMIN_ROLE");

    // ============ State Variables ============
    
    /// @notice Address of the associated vault contract
    address public immutable vault;
    
    /// @notice Mapping of whitelisted investor addresses
    mapping(address => bool) private _whitelist;
    
    /// @notice Lockup end timestamp for each investor
    mapping(address => uint256) private _lockupEnd;
    
    /// @notice Default lockup period in seconds (7 days)
    uint256 public lockupPeriod = 7 days;
    
    /// @notice Whether transfer restrictions are enabled
    bool public transferRestrictionsEnabled = true;

    // ============ Events ============
    
    /// @notice Emitted when tokens are minted to an investor
    event TokensMinted(address indexed to, uint256 amount, uint256 lockupEnd);
    
    /// @notice Emitted when tokens are burned (repayment)
    event TokensBurned(address indexed from, uint256 amount);
    
    /// @notice Emitted when an investor is added to whitelist
    event InvestorWhitelisted(address indexed account, uint256 timestamp);
    
    /// @notice Emitted when an investor is removed from whitelist
    event InvestorRemovedFromWhitelist(address indexed account, uint256 timestamp);
    
    /// @notice Emitted when lockup period is changed
    event LockupPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    
    /// @notice Emitted when transfer restrictions are toggled
    event TransferRestrictionsToggled(bool enabled);

    // ============ Errors ============
    
    error NotWhitelisted(address account);
    error TransferRestricted(address from, address to);
    error LockupNotExpired(address account, uint256 lockupEnd);
    error ZeroAddress();
    error ZeroAmount();
    error InvalidLockupPeriod();

    // ============ Constructor ============
    
    /**
     * @notice Creates a new DebtToken for a specific vault
     * @param name_ Token name (e.g., "TigerPay Debt - Merchant XYZ")
     * @param symbol_ Token symbol (e.g., "TPD-001")
     * @param vault_ Address of the associated MerchantVault
     * @param admin Admin address who receives all management roles
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address vault_,
        address admin
    ) ERC20(name_, symbol_) {
        if (vault_ == address(0)) revert ZeroAddress();
        if (admin == address(0)) revert ZeroAddress();
        
        vault = vault_;
        
        // Grant roles to admin
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(WHITELIST_ADMIN_ROLE, admin);
        
        // Grant minter role to vault contract
        _grantRole(MINTER_ROLE, vault_);
        
        // Vault is always whitelisted (for receiving returned tokens)
        _whitelist[vault_] = true;
    }

    // ============ External Functions ============
    
    /**
     * @notice Mint tokens to an investor
     * @dev Only callable by MINTER_ROLE (vault or admin)
     * @param to Recipient address (must be whitelisted)
     * @param amount Number of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!_whitelist[to]) revert NotWhitelisted(to);
        
        // Set lockup end time
        _lockupEnd[to] = block.timestamp + lockupPeriod;
        
        _mint(to, amount);
        
        emit TokensMinted(to, amount, _lockupEnd[to]);
    }
    
    /**
     * @notice Burn tokens from an account (for repayment distribution)
     * @dev Overrides ERC20Burnable to add event
     * @param from Account to burn tokens from
     * @param amount Number of tokens to burn
     */
    function burnFrom(address from, uint256 amount) public override {
        super.burnFrom(from, amount);
        emit TokensBurned(from, amount);
    }
    
    /**
     * @notice Pause all token transfers
     * @dev Only callable by PAUSER_ROLE
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause token transfers
     * @dev Only callable by PAUSER_ROLE
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Add an investor to the whitelist
     * @dev Only callable by WHITELIST_ADMIN_ROLE
     * @param account Address to whitelist
     */
    function addToWhitelist(address account) external onlyRole(WHITELIST_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        
        _whitelist[account] = true;
        emit InvestorWhitelisted(account, block.timestamp);
    }
    
    /**
     * @notice Add multiple investors to the whitelist
     * @dev Only callable by WHITELIST_ADMIN_ROLE
     * @param accounts Array of addresses to whitelist
     */
    function addToWhitelistBatch(address[] calldata accounts) external onlyRole(WHITELIST_ADMIN_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == address(0)) revert ZeroAddress();
            _whitelist[accounts[i]] = true;
            emit InvestorWhitelisted(accounts[i], block.timestamp);
        }
    }
    
    /**
     * @notice Remove an investor from the whitelist
     * @dev Only callable by WHITELIST_ADMIN_ROLE
     * @param account Address to remove
     */
    function removeFromWhitelist(address account) external onlyRole(WHITELIST_ADMIN_ROLE) {
        _whitelist[account] = false;
        emit InvestorRemovedFromWhitelist(account, block.timestamp);
    }
    
    /**
     * @notice Update the lockup period for new mints
     * @dev Only callable by DEFAULT_ADMIN_ROLE
     * @param newPeriod New lockup period in seconds
     */
    function setLockupPeriod(uint256 newPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newPeriod > 365 days) revert InvalidLockupPeriod();
        
        uint256 oldPeriod = lockupPeriod;
        lockupPeriod = newPeriod;
        
        emit LockupPeriodUpdated(oldPeriod, newPeriod);
    }
    
    /**
     * @notice Toggle transfer restrictions
     * @dev Only callable by DEFAULT_ADMIN_ROLE
     * @param enabled Whether restrictions should be enabled
     */
    function setTransferRestrictions(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        transferRestrictionsEnabled = enabled;
        emit TransferRestrictionsToggled(enabled);
    }

    // ============ View Functions ============
    
    /**
     * @notice Check if an address is whitelisted
     * @param account Address to check
     * @return bool True if whitelisted
     */
    function isWhitelisted(address account) external view returns (bool) {
        return _whitelist[account];
    }
    
    /**
     * @notice Get the lockup end timestamp for an address
     * @param account Address to check
     * @return uint256 Lockup end timestamp (0 if no lockup)
     */
    function getLockupEnd(address account) external view returns (uint256) {
        return _lockupEnd[account];
    }
    
    /**
     * @notice Check if tokens can be transferred from an account
     * @param account Address to check
     * @return bool True if lockup has expired
     */
    function canTransfer(address account) external view returns (bool) {
        return block.timestamp >= _lockupEnd[account];
    }
    
    /**
     * @notice Returns the number of decimals (18, same as ETH)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }

    // ============ Internal Functions ============
    
    /**
     * @dev Hook called before any transfer of tokens
     * Enforces whitelist and lockup restrictions
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        // Skip checks for minting (from == address(0)) and burning (to == address(0))
        if (from != address(0) && to != address(0) && transferRestrictionsEnabled) {
            // Check sender whitelist and lockup
            if (!_whitelist[from]) revert NotWhitelisted(from);
            if (block.timestamp < _lockupEnd[from]) {
                revert LockupNotExpired(from, _lockupEnd[from]);
            }
            
            // Check recipient whitelist
            if (!_whitelist[to]) revert NotWhitelisted(to);
        }
        
        super._update(from, to, amount);
    }
    
    /**
     * @dev Required override for AccessControl
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
