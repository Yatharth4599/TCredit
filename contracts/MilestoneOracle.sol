// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MilestoneOracle
 * @author TigerPay
 * @notice Oracle contract for milestone verification and tranche release authorization
 * @dev Implements multi-signature verification with dispute resolution
 * 
 * Security Features (inspired by zktoosh):
 * - Multi-sig approval for milestone verification
 * - Dispute resolution mechanism
 * - Timeouts for pending verifications
 * - Evidence submission and tracking
 */
contract MilestoneOracle is AccessControl, ReentrancyGuard, Pausable {
    
    // ============ Roles ============
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    // ============ Enums ============
    enum MilestoneStatus { PENDING, SUBMITTED, APPROVED, REJECTED, DISPUTED }

    // ============ Structs ============
    struct Milestone {
        address vault;
        uint256 milestoneId;
        string description;
        bytes32 evidenceHash;
        MilestoneStatus status;
        uint256 submittedAt;
        uint256 approvalCount;
        uint256 rejectionCount;
        uint256 requiredApprovals;
        bool disputed;
        string disputeReason;
    }
    
    struct VerifierVote {
        bool hasVoted;
        bool approved;
        uint256 votedAt;
        string comment;
    }

    // ============ State Variables ============
    
    /// @notice Number of approvals required for milestone
    uint256 public defaultRequiredApprovals = 2;
    
    /// @notice Timeout for milestone verification (7 days)
    uint256 public verificationTimeout = 7 days;
    
    /// @notice Dispute resolution timeout (14 days)
    uint256 public disputeTimeout = 14 days;
    
    /// @notice All milestones
    mapping(bytes32 => Milestone) public milestones;
    
    /// @notice Verifier votes per milestone
    mapping(bytes32 => mapping(address => VerifierVote)) public verifierVotes;
    
    /// @notice Milestone IDs by vault
    mapping(address => bytes32[]) public vaultMilestones;
    
    /// @notice Counter for generating unique IDs
    uint256 public milestoneCounter;

    // ============ Events ============
    
    event MilestoneCreated(
        bytes32 indexed milestoneKey,
        address indexed vault,
        uint256 indexed milestoneId,
        string description
    );
    
    event MilestoneSubmitted(
        bytes32 indexed milestoneKey,
        address indexed submitter,
        bytes32 evidenceHash
    );
    
    event MilestoneVoted(
        bytes32 indexed milestoneKey,
        address indexed verifier,
        bool approved,
        string comment
    );
    
    event MilestoneApproved(
        bytes32 indexed milestoneKey,
        address indexed vault,
        uint256 milestoneId
    );
    
    event MilestoneRejected(
        bytes32 indexed milestoneKey,
        string reason
    );
    
    event MilestoneDisputed(
        bytes32 indexed milestoneKey,
        address indexed disputer,
        string reason
    );
    
    event DisputeResolved(
        bytes32 indexed milestoneKey,
        bool approved,
        address indexed arbiter
    );

    // ============ Errors ============
    
    error MilestoneNotFound(bytes32 key);
    error InvalidStatus(MilestoneStatus current, MilestoneStatus required);
    error AlreadyVoted(address verifier);
    error NotSubmitted();
    error VerificationTimedOut();
    error DisputeTimedOut();
    error AlreadyDisputed();
    error ZeroAddress();
    error InvalidMilestoneId();

    // ============ Constructor ============
    
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(ARBITER_ROLE, admin);
    }

    // ============ External Functions ============
    
    /**
     * @notice Create a new milestone for a vault
     * @param vault Vault address
     * @param milestoneId Milestone index in vault
     * @param description Milestone description
     */
    function createMilestone(
        address vault,
        uint256 milestoneId,
        string calldata description
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        returns (bytes32 milestoneKey)
    {
        if (vault == address(0)) revert ZeroAddress();
        
        milestoneKey = _getMilestoneKey(vault, milestoneId);
        
        milestones[milestoneKey] = Milestone({
            vault: vault,
            milestoneId: milestoneId,
            description: description,
            evidenceHash: bytes32(0),
            status: MilestoneStatus.PENDING,
            submittedAt: 0,
            approvalCount: 0,
            rejectionCount: 0,
            requiredApprovals: defaultRequiredApprovals,
            disputed: false,
            disputeReason: ""
        });
        
        vaultMilestones[vault].push(milestoneKey);
        milestoneCounter++;
        
        emit MilestoneCreated(milestoneKey, vault, milestoneId, description);
    }
    
    /**
     * @notice Submit milestone completion evidence
     * @param vault Vault address
     * @param milestoneId Milestone ID
     * @param evidenceHash IPFS hash or other proof
     */
    function submitMilestone(
        address vault,
        uint256 milestoneId,
        bytes32 evidenceHash
    ) external whenNotPaused {
        bytes32 key = _getMilestoneKey(vault, milestoneId);
        Milestone storage milestone = milestones[key];
        
        if (milestone.vault == address(0)) revert MilestoneNotFound(key);
        if (milestone.status != MilestoneStatus.PENDING) {
            revert InvalidStatus(milestone.status, MilestoneStatus.PENDING);
        }
        
        milestone.evidenceHash = evidenceHash;
        milestone.status = MilestoneStatus.SUBMITTED;
        milestone.submittedAt = block.timestamp;
        
        emit MilestoneSubmitted(key, msg.sender, evidenceHash);
    }
    
    /**
     * @notice Vote on a milestone (verifiers only)
     * @param vault Vault address
     * @param milestoneId Milestone ID
     * @param approved Whether to approve
     * @param comment Verifier's comment
     */
    function voteMilestone(
        address vault,
        uint256 milestoneId,
        bool approved,
        string calldata comment
    ) 
        external 
        onlyRole(VERIFIER_ROLE) 
        whenNotPaused 
    {
        bytes32 key = _getMilestoneKey(vault, milestoneId);
        Milestone storage milestone = milestones[key];
        
        if (milestone.vault == address(0)) revert MilestoneNotFound(key);
        if (milestone.status != MilestoneStatus.SUBMITTED) {
            revert InvalidStatus(milestone.status, MilestoneStatus.SUBMITTED);
        }
        if (block.timestamp > milestone.submittedAt + verificationTimeout) {
            revert VerificationTimedOut();
        }
        
        VerifierVote storage vote = verifierVotes[key][msg.sender];
        if (vote.hasVoted) revert AlreadyVoted(msg.sender);
        
        vote.hasVoted = true;
        vote.approved = approved;
        vote.votedAt = block.timestamp;
        vote.comment = comment;
        
        if (approved) {
            milestone.approvalCount++;
        } else {
            milestone.rejectionCount++;
        }
        
        emit MilestoneVoted(key, msg.sender, approved, comment);
        
        // Check if enough approvals
        if (milestone.approvalCount >= milestone.requiredApprovals) {
            milestone.status = MilestoneStatus.APPROVED;
            emit MilestoneApproved(key, vault, milestoneId);
        }
        
        // Check if rejection threshold (same as approvals)
        if (milestone.rejectionCount >= milestone.requiredApprovals) {
            milestone.status = MilestoneStatus.REJECTED;
            emit MilestoneRejected(key, "Rejected by verifiers");
        }
    }
    
    /**
     * @notice Dispute a milestone decision
     * @param vault Vault address  
     * @param milestoneId Milestone ID
     * @param reason Dispute reason
     */
    function disputeMilestone(
        address vault,
        uint256 milestoneId,
        string calldata reason
    ) external whenNotPaused {
        bytes32 key = _getMilestoneKey(vault, milestoneId);
        Milestone storage milestone = milestones[key];
        
        if (milestone.vault == address(0)) revert MilestoneNotFound(key);
        if (milestone.disputed) revert AlreadyDisputed();
        if (milestone.status != MilestoneStatus.APPROVED && 
            milestone.status != MilestoneStatus.REJECTED) {
            revert InvalidStatus(milestone.status, MilestoneStatus.APPROVED);
        }
        
        milestone.disputed = true;
        milestone.status = MilestoneStatus.DISPUTED;
        milestone.disputeReason = reason;
        
        emit MilestoneDisputed(key, msg.sender, reason);
    }
    
    /**
     * @notice Resolve a dispute (arbiter only)
     * @param vault Vault address
     * @param milestoneId Milestone ID
     * @param approved Final decision
     */
    function resolveDispute(
        address vault,
        uint256 milestoneId,
        bool approved
    ) 
        external 
        onlyRole(ARBITER_ROLE) 
    {
        bytes32 key = _getMilestoneKey(vault, milestoneId);
        Milestone storage milestone = milestones[key];
        
        if (milestone.vault == address(0)) revert MilestoneNotFound(key);
        if (milestone.status != MilestoneStatus.DISPUTED) {
            revert InvalidStatus(milestone.status, MilestoneStatus.DISPUTED);
        }
        
        milestone.status = approved ? MilestoneStatus.APPROVED : MilestoneStatus.REJECTED;
        
        emit DisputeResolved(key, approved, msg.sender);
        
        if (approved) {
            emit MilestoneApproved(key, vault, milestoneId);
        } else {
            emit MilestoneRejected(key, "Rejected by arbiter");
        }
    }
    
    /**
     * @notice Pause the oracle
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the oracle
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Update required approvals
     */
    function setRequiredApprovals(uint256 count) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultRequiredApprovals = count;
    }

    // ============ View Functions ============
    
    /**
     * @notice Check if milestone is approved
     */
    function isMilestoneApproved(address vault, uint256 milestoneId) 
        external 
        view 
        returns (bool) 
    {
        bytes32 key = _getMilestoneKey(vault, milestoneId);
        return milestones[key].status == MilestoneStatus.APPROVED;
    }
    
    /**
     * @notice Get milestone details
     */
    function getMilestone(address vault, uint256 milestoneId) 
        external 
        view 
        returns (Milestone memory) 
    {
        bytes32 key = _getMilestoneKey(vault, milestoneId);
        return milestones[key];
    }
    
    /**
     * @notice Get all milestones for a vault
     */
    function getVaultMilestones(address vault) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return vaultMilestones[vault];
    }

    // ============ Internal Functions ============
    
    function _getMilestoneKey(address vault, uint256 milestoneId) 
        internal 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encodePacked(vault, milestoneId));
    }
}
