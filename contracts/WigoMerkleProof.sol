// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

/// ============ Imports ============

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title WigoMerkleProof
/// @notice ERC20 vesting contract claimable by airdrop winners
/// @author WigoSwap <info@wigoswap.io>

contract WigoMerkleProof {
    using SafeERC20 for IERC20;

    /// ERC20 basic token contract being held
    IERC20 private immutable _token;

    /// timestamp when token release is enabled
    uint256 private immutable _releaseTime;

    /// ============ Immutable storage ============

    /// @notice ERC20-claimee inclusion root
    bytes32 public immutable _merkleRoot;

    /// ============ Mutable storage ============

    /// @notice Mapping of addresses who have claimed tokens
    mapping(address => bool) public hasClaimed;

    /// ============ Errors ============

    /// @notice Thrown if address has already claimed
    error AlreadyClaimed();
    /// @notice Thrown if address/amount are not part of Merkle tree
    error NotInMerkle();
    /// @notice Thrown if token balance is not enough
    error NotEnoughToken();
    /// @notice Thrown if the time for release has not come
    error NotReleaseTime();

    /// ============ Constructor ============

    /// @notice Creates a new WigoMerkleProof contract
    /// @param token_ address of token
    /// @param releaseTime_ release timestamp
    /// @param merkleRoot_ of claimees
    constructor(
        IERC20 token_,
        uint256 releaseTime_,
        bytes32 merkleRoot_
    ) {
        require(
            releaseTime_ > block.timestamp,
            "WigoMerkleProof: release time is before current time"
        );
        _token = token_;
        _releaseTime = releaseTime_;
        _merkleRoot = merkleRoot_;
    }

    /// ============ Events ============

    /// @notice Emitted after a successful token claim
    /// @param to recipient of claim
    /// @param amount of tokens claimed
    event Claim(address indexed to, uint256 amount);

    /// ============ Functions ============

    /// @notice token contract being held
    function token() public view virtual returns (IERC20) {
        return _token;
    }

    /// @notice token release timestamp
    function releaseTime() public view virtual returns (uint256) {
        return _releaseTime;
    }

    /// @notice Allows claiming tokens if address is part of merkle tree and it's time to release.
    /// @param to address of claimee
    /// @param amount of tokens owed to claimee
    /// @param proof merkle proof to prove address and amount are in tree
    function claim(
        address to,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        // Throw if the time for release has not come
        if (releaseTime() > block.timestamp) revert NotReleaseTime();

        uint256 balance = token().balanceOf(address(this));
        // Throw if token balance is not enough
        if (balance < amount || balance == 0) revert NotEnoughToken();

        // Throw if address has already claimed tokens
        if (hasClaimed[to]) revert AlreadyClaimed();

        // Verify merkle proof, or revert if not in tree
        bytes32 leaf = keccak256(abi.encodePacked(to, amount));
        bool isValidLeaf = MerkleProof.verify(proof, _merkleRoot, leaf);
        if (!isValidLeaf) revert NotInMerkle();

        // Set address to claimed
        hasClaimed[to] = true;

        // send tokens to address
        token().safeTransfer(to, amount);

        // Emit claim event
        emit Claim(to, amount);
    }
}
