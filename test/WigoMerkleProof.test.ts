import { ethers } from "hardhat"
import { expect } from "chai"
import { advanceTime, getBigNumber } from "./utilities"

// Release Time
const RELEASE_TIME = Math.floor(Date.now() / 1000) + 2592000

// Merkle root containing Alice with 100e18 tokens, Bob with 50e18 tokens and but no Carol
const MERKLE_ROOT = "0xed1f3f1dec74c5b9c9e18220667c2c8acc87064a6cb311b22b7a52d00e1add21"

describe("WigoMerkleProof", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0] // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    this.bob = this.signers[1] // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
    this.carol = this.signers[2]
    this.minter = this.signers[3]

    this.wigoMerkle = await ethers.getContractFactory("WigoMerkleProof")
    this.tokenERC20 = await ethers.getContractFactory("MockERC20", this.minter)

    this.token = await this.tokenERC20.deploy("Token A", "TA", getBigNumber(1000))
    await this.token.deployed()

    this.merkle = await this.wigoMerkle.deploy(this.token.address, RELEASE_TIME, MERKLE_ROOT)
    await this.merkle.deployed()
  })

  it("Should set correct state variables", async function () {
    const tokenAddress = await this.merkle.token()
    const releaseAt = await this.merkle.releaseTime()
    const merkleRoot = await this.merkle._merkleRoot()

    expect(tokenAddress).to.equal(this.token.address)
    expect(releaseAt).to.equal(RELEASE_TIME)
    expect(merkleRoot).to.equal(MERKLE_ROOT)
  })

  it("It should be after release time", async function () {
    const aliceProof = ["0x27aa7447e4bb8d03f3289de54cfd714faaa432f91aac707b2cdc3825e5a5dfeb"]
    await expect(this.merkle.claim(this.alice.address, getBigNumber(100), aliceProof)).to.be.revertedWith("NotReleaseTime()")
    expect(await this.token.balanceOf(this.alice.address)).to.equal(0)

    await advanceTime(2592000)
    await expect(this.merkle.claim(this.alice.address, getBigNumber(100), aliceProof)).to.be.revertedWith("NotEnoughToken()")
    expect(await this.token.balanceOf(this.alice.address)).to.equal(0)
  })

  it("Allow Alice to claim 100e18 tokens", async function () {
    await this.token.transfer(this.merkle.address, getBigNumber(500))
    expect(await this.token.balanceOf(this.merkle.address)).to.equal(getBigNumber(500))
    expect(await this.token.balanceOf(this.alice.address)).to.equal(0)

    const aliceProof = ["0x27aa7447e4bb8d03f3289de54cfd714faaa432f91aac707b2cdc3825e5a5dfeb"]
    await this.merkle.claim(this.alice.address, getBigNumber(100), aliceProof)
    expect(await this.token.balanceOf(this.merkle.address)).to.equal(getBigNumber(400))
    expect(await this.token.balanceOf(this.alice.address)).to.equal(getBigNumber(100))
  })

  it("Prevent Alice from claiming twice", async function () {
    const aliceProof = ["0x27aa7447e4bb8d03f3289de54cfd714faaa432f91aac707b2cdc3825e5a5dfeb"]
    await expect(this.merkle.claim(this.alice.address, getBigNumber(100), aliceProof)).to.be.revertedWith("AlreadyClaimed()")
    expect(await this.token.balanceOf(this.merkle.address)).to.equal(getBigNumber(400))
    expect(await this.token.balanceOf(this.alice.address)).to.equal(getBigNumber(100))
  })

  it("Prevent Bob from claiming with invalid proof", async function () {
    // Bob valid proof: 0x271e61abd8219c77862fda17c0c094302fa9884962394db34da950745db9fbbb
    const bobProof = ["0x27aa7447e4bb8d03f3289de54cfd714faaa432f91aac707b2cdc3825e5a5dfeb"]
    await expect(this.merkle.claim(this.bob.address, getBigNumber(50), bobProof)).to.be.revertedWith("NotInMerkle()")
    expect(await this.token.balanceOf(this.merkle.address)).to.equal(getBigNumber(400))
    expect(await this.token.balanceOf(this.bob.address)).to.equal(0)
  })

  it("Prevent Bob from claiming with invalid proof", async function () {
    const bobProof = ["0x271e61abd8219c77862fda17c0c094302fa9884962394db34da950745db9fbbb"]
    await expect(this.merkle.claim(this.bob.address, getBigNumber(100), bobProof)).to.be.revertedWith("NotInMerkle()")
    expect(await this.token.balanceOf(this.merkle.address)).to.equal(getBigNumber(400))
    expect(await this.token.balanceOf(this.bob.address)).to.equal(0)
  })

  it("Prevent Carol from claiming", async function () {
    const carolProof = ["0x271e61abd8219c77862fda17c0c094302fa9884962394db34da950745db9fbbb"]
    await expect(this.merkle.claim(this.carol.address, getBigNumber(50), carolProof)).to.be.revertedWith("NotInMerkle()")
    expect(await this.token.balanceOf(this.merkle.address)).to.equal(getBigNumber(400))
    expect(await this.token.balanceOf(this.carol.address)).to.equal(0)
  })

  it("Let Carol claim on behalf of Bob", async function () {
    const bobProof = ["0x271e61abd8219c77862fda17c0c094302fa9884962394db34da950745db9fbbb"]
    await this.merkle.connect(this.carol).claim(this.bob.address, getBigNumber(50), bobProof, { from: this.carol.address })
    expect(await this.token.balanceOf(this.merkle.address)).to.equal(getBigNumber(350))
    expect(await this.token.balanceOf(this.bob.address)).to.equal(getBigNumber(50))
    expect(await this.token.balanceOf(this.carol.address)).to.equal(0)
  })
})
