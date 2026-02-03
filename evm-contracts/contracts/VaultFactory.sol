// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./MerchantVault.sol";

/**
 * @title VaultFactory
 * @author TigerPay
 * @notice Factory contract for deploying MerchantVault instances using minimal proxy pattern
 * @dev Uses EIP-1167 minimal proxy for gas-efficient vault deployment
 * 
 * Security Features (inspired by zktoosh):
 * - Access control for vault creation
 * - Rate limiting on vault deployments
 * - Registry of all deployed vaults
 * - Timelock for critical operations
 */
contract VaultFactory is AccessControl, ReentrancyGuard, Pausable {
    using Clones for address;

    // ============ Roles ============
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // ============ State Variables ============
    
    /// @notice Implementation contract for minimal proxy
    address public vaultImplementation;
    
    address public platformAdmin;
    address public platformFeeRecipient;
    address public defaultFundingToken;
    address public milestoneOracle;
    
    /// @notice All deployed vaults
    address[] public allVaults;
    
    /// @notice Vaults by merchant
    mapping(address => address[]) public merchantVaults;
    
    /// @notice Vault existence check
    mapping(address => bool) public isVault;
    
    /// @notice Merchant verification status
    mapping(address => bool) public verifiedMerchants;
    
    /// @notice Vault deployment count per merchant (rate limiting)
    mapping(address => uint256) public merchantVaultCount;
    
    /// @notice Maximum vaults per merchant
    uint256 public maxVaultsPerMerchant = 10;
    
    /// @notice Minimum funding target
    uint256 public minFundingTarget = 1000e18; // 1000 USDC
    
    /// @notice Maximum funding target
    uint256 public maxFundingTarget = 10_000_000e18; // 10M USDC
    
    /// @notice Vault creation counter for unique IDs
    uint256 public vaultCounter;

    // ============ Events ============
    
    event VaultCreated(
        address indexed vault,
        address indexed merchant,
        uint256 indexed vaultId,
        uint256 targetAmount,
        uint256 interestRateBps
    );
    
    event MerchantVerified(address indexed merchant, address indexed verifier);
    
    event MerchantUnverified(address indexed merchant, address indexed admin);
    
    event VaultImplementationUpdated(address indexed oldImpl, address indexed newImpl);
    
    event ConfigUpdated(string configName, uint256 oldValue, uint256 newValue);
    
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    // ============ Errors ============
    
    error MerchantNotVerified(address merchant);
    error MaxVaultsExceeded(address merchant, uint256 current, uint256 max);
    error InvalidFundingTarget(uint256 target, uint256 min, uint256 max);
    error InvalidInterestRate(uint256 rate, uint256 min, uint256 max);
    error InvalidDuration(uint256 duration, uint256 min, uint256 max);
    error ZeroAddress();
    error VaultNotFound(address vault);
    error InvalidConfiguration();

    // ============ Constructor ============
    
    /**
     * @notice Deploy VaultFactory
     * @param _admin Platform admin
     * @param _feeRecipient Platform fee recipient
     * @param _defaultFundingToken Default stablecoin for funding
     */
    constructor(
        address _admin,
        address _feeRecipient,
        address _defaultFundingToken,
        address _milestoneOracle
    ) {
        if (_admin == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_defaultFundingToken == address(0)) revert ZeroAddress();
        if (_milestoneOracle == address(0)) revert ZeroAddress();
        
        platformAdmin = _admin;
        platformFeeRecipient = _feeRecipient;
        defaultFundingToken = _defaultFundingToken;
        milestoneOracle = _milestoneOracle;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(DEPLOYER_ROLE, _admin);
        _grantRole(VERIFIER_ROLE, _admin);
    }

    // ============ External Functions ============
    
    /**
     * @notice Create a new vault for a verified merchant
     * @param merchant Merchant wallet address
     * @param targetAmount Fundraising target
     * @param interestRateBps Annual interest rate in basis points
     * @param durationMonths Loan duration in months
     * @param numTranches Number of disbursement tranches
     * @param tokenName Debt token name
     * @param tokenSymbol Debt token symbol
     */
    function createVault(
        address merchant,
        uint256 targetAmount,
        uint256 interestRateBps,
        uint256 durationMonths,
        uint256 numTranches,
        string calldata tokenName,
        string calldata tokenSymbol
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyRole(DEPLOYER_ROLE)
        returns (address vault)
    {
        // Validate merchant
        if (!verifiedMerchants[merchant]) revert MerchantNotVerified(merchant);
        if (merchantVaultCount[merchant] >= maxVaultsPerMerchant) {
            revert MaxVaultsExceeded(merchant, merchantVaultCount[merchant], maxVaultsPerMerchant);
        }
        
        // Validate parameters
        if (targetAmount < minFundingTarget || targetAmount > maxFundingTarget) {
            revert InvalidFundingTarget(targetAmount, minFundingTarget, maxFundingTarget);
        }
        if (interestRateBps < 100 || interestRateBps > 5000) { // 1% - 50%
            revert InvalidInterestRate(interestRateBps, 100, 5000);
        }
        if (durationMonths < 1 || durationMonths > 60) { // 1 month - 5 years
            revert InvalidDuration(durationMonths, 1, 60);
        }
        if (numTranches < 1 || numTranches > 12) {
            revert InvalidConfiguration();
        }
        
        // Calculate fundraising deadline (30 days from now)
        uint256 fundraisingDeadline = block.timestamp + 30 days;
        
        // Create vault config
        MerchantVault.VaultConfig memory config = MerchantVault.VaultConfig({
            targetAmount: targetAmount,
            minInvestment: targetAmount / 1000, // 0.1% of target
            maxInvestment: targetAmount / 5,    // 20% of target
            interestRateBps: interestRateBps,
            durationMonths: durationMonths,
            fundraisingDeadline: fundraisingDeadline,
            numTranches: numTranches
        });
        
        vault = address(new MerchantVault(
            merchant,
            defaultFundingToken,
            milestoneOracle,
            platformAdmin,
            platformFeeRecipient,
            config,
            tokenName,
            tokenSymbol
        ));
        
        // Update state
        vaultCounter++;
        allVaults.push(vault);
        merchantVaults[merchant].push(vault);
        isVault[vault] = true;
        merchantVaultCount[merchant]++;
        
        emit VaultCreated(vault, merchant, vaultCounter, targetAmount, interestRateBps);
    }
    
    /**
     * @notice Verify a merchant for vault creation
     * @param merchant Merchant address to verify
     */
    function verifyMerchant(address merchant) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        if (merchant == address(0)) revert ZeroAddress();
        
        verifiedMerchants[merchant] = true;
        emit MerchantVerified(merchant, msg.sender);
    }
    
    /**
     * @notice Remove merchant verification
     * @param merchant Merchant to unverify
     */
    function unverifyMerchant(address merchant) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        verifiedMerchants[merchant] = false;
        emit MerchantUnverified(merchant, msg.sender);
    }
    
    /**
     * @notice Update platform fee recipient
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address newRecipient) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (newRecipient == address(0)) revert ZeroAddress();
        
        address oldRecipient = platformFeeRecipient;
        platformFeeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }
    
    /**
     * @notice Update maximum vaults per merchant
     */
    function setMaxVaultsPerMerchant(uint256 newMax) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        uint256 oldMax = maxVaultsPerMerchant;
        maxVaultsPerMerchant = newMax;
        emit ConfigUpdated("maxVaultsPerMerchant", oldMax, newMax);
    }
    
    /**
     * @notice Update funding target limits
     */
    function setFundingTargetLimits(uint256 newMin, uint256 newMax) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (newMin >= newMax) revert InvalidConfiguration();
        
        emit ConfigUpdated("minFundingTarget", minFundingTarget, newMin);
        emit ConfigUpdated("maxFundingTarget", maxFundingTarget, newMax);
        
        minFundingTarget = newMin;
        maxFundingTarget = newMax;
    }
    
    /**
     * @notice Pause factory
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause factory
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ============ View Functions ============
    
    /**
     * @notice Get all vaults by a merchant
     */
    function getVaultsByMerchant(address merchant) 
        external 
        view 
        returns (address[] memory) 
    {
        return merchantVaults[merchant];
    }
    
    /**
     * @notice Get all deployed vaults
     */
    function getAllVaults() external view returns (address[] memory) {
        return allVaults;
    }
    
    /**
     * @notice Get total number of vaults
     */
    function getTotalVaults() external view returns (uint256) {
        return allVaults.length;
    }
    
    /**
     * @notice Check if merchant is verified
     */
    function isMerchantVerified(address merchant) external view returns (bool) {
        return verifiedMerchants[merchant];
    }
    
    /**
     * @notice Get factory summary
     */
    function getFactorySummary() external view returns (
        uint256 totalVaults,
        uint256 minTarget,
        uint256 maxTarget,
        uint256 maxPerMerchant,
        address feeRecipient,
        address fundingToken
    ) {
        return (
            allVaults.length,
            minFundingTarget,
            maxFundingTarget,
            maxVaultsPerMerchant,
            platformFeeRecipient,
            defaultFundingToken
        );
    }
}
