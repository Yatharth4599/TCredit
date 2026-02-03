const { expect } = require("chai");
const hre = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const ethers = hre.ethers;

describe("DebtToken", function () {
    // Fixture to deploy contract with consistent state
    async function deployDebtTokenFixture() {
        const [admin, vault, investor1, investor2, nonWhitelisted] = await ethers.getSigners();

        const DebtTokenFactory = await ethers.getContractFactory("DebtToken");
        const debtToken = await DebtTokenFactory.deploy(
            "TigerPay Debt Token - Test Merchant",
            "TPD-001",
            vault.address,
            admin.address
        );
        await debtToken.waitForDeployment();

        // Whitelist investors
        await debtToken.connect(admin).addToWhitelist(investor1.address);
        await debtToken.connect(admin).addToWhitelist(investor2.address);

        return { debtToken, admin, vault, investor1, investor2, nonWhitelisted };
    }

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            const { debtToken } = await loadFixture(deployDebtTokenFixture);

            expect(await debtToken.name()).to.equal("TigerPay Debt Token - Test Merchant");
            expect(await debtToken.symbol()).to.equal("TPD-001");
        });

        it("Should set the vault address correctly", async function () {
            const { debtToken, vault } = await loadFixture(deployDebtTokenFixture);

            expect(await debtToken.vault()).to.equal(vault.address);
        });

        it("Should grant admin all roles", async function () {
            const { debtToken, admin } = await loadFixture(deployDebtTokenFixture);

            const DEFAULT_ADMIN_ROLE = await debtToken.DEFAULT_ADMIN_ROLE();
            const MINTER_ROLE = await debtToken.MINTER_ROLE();
            const PAUSER_ROLE = await debtToken.PAUSER_ROLE();
            const WHITELIST_ADMIN_ROLE = await debtToken.WHITELIST_ADMIN_ROLE();

            expect(await debtToken.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
            expect(await debtToken.hasRole(MINTER_ROLE, admin.address)).to.be.true;
            expect(await debtToken.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
            expect(await debtToken.hasRole(WHITELIST_ADMIN_ROLE, admin.address)).to.be.true;
        });

        it("Should grant minter role to vault", async function () {
            const { debtToken, vault } = await loadFixture(deployDebtTokenFixture);

            const MINTER_ROLE = await debtToken.MINTER_ROLE();
            expect(await debtToken.hasRole(MINTER_ROLE, vault.address)).to.be.true;
        });

        it("Should whitelist the vault by default", async function () {
            const { debtToken, vault } = await loadFixture(deployDebtTokenFixture);

            expect(await debtToken.isWhitelisted(vault.address)).to.be.true;
        });

        it("Should set default lockup period to 7 days", async function () {
            const { debtToken } = await loadFixture(deployDebtTokenFixture);

            expect(await debtToken.lockupPeriod()).to.equal(7 * 24 * 60 * 60);
        });

        it("Should revert if vault address is zero", async function () {
            const [admin] = await ethers.getSigners();

            const DebtTokenFactory = await ethers.getContractFactory("DebtToken");
            await expect(
                DebtTokenFactory.deploy("Test", "TST", ethers.ZeroAddress, admin.address)
            ).to.be.revertedWithCustomError(DebtTokenFactory, "ZeroAddress");
        });

        it("Should revert if admin address is zero", async function () {
            const [_, vault] = await ethers.getSigners();

            const DebtTokenFactory = await ethers.getContractFactory("DebtToken");
            await expect(
                DebtTokenFactory.deploy("Test", "TST", vault.address, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(DebtTokenFactory, "ZeroAddress");
        });
    });

    describe("Minting", function () {
        it("Should allow minter to mint tokens to whitelisted investor", async function () {
            const { debtToken, vault, investor1 } = await loadFixture(deployDebtTokenFixture);

            const amount = ethers.parseEther("1000");
            await debtToken.connect(vault).mint(investor1.address, amount);

            expect(await debtToken.balanceOf(investor1.address)).to.equal(amount);
        });

        it("Should emit TokensMinted event", async function () {
            const { debtToken, vault, investor1 } = await loadFixture(deployDebtTokenFixture);

            const amount = ethers.parseEther("1000");
            await expect(debtToken.connect(vault).mint(investor1.address, amount))
                .to.emit(debtToken, "TokensMinted");
        });

        it("Should set lockup end time on mint", async function () {
            const { debtToken, vault, investor1 } = await loadFixture(deployDebtTokenFixture);

            const amount = ethers.parseEther("1000");
            await debtToken.connect(vault).mint(investor1.address, amount);

            const lockupEnd = await debtToken.getLockupEnd(investor1.address);
            const lockupPeriod = await debtToken.lockupPeriod();
            const blockTime = await time.latest();

            expect(lockupEnd).to.be.closeTo(BigInt(blockTime) + lockupPeriod, 5n);
        });

        it("Should revert minting to non-whitelisted address", async function () {
            const { debtToken, vault, nonWhitelisted } = await loadFixture(deployDebtTokenFixture);

            const amount = ethers.parseEther("1000");
            await expect(
                debtToken.connect(vault).mint(nonWhitelisted.address, amount)
            ).to.be.revertedWithCustomError(debtToken, "NotWhitelisted");
        });

        it("Should revert minting to zero address", async function () {
            const { debtToken, vault } = await loadFixture(deployDebtTokenFixture);

            await expect(
                debtToken.connect(vault).mint(ethers.ZeroAddress, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(debtToken, "ZeroAddress");
        });

        it("Should revert minting zero amount", async function () {
            const { debtToken, vault, investor1 } = await loadFixture(deployDebtTokenFixture);

            await expect(
                debtToken.connect(vault).mint(investor1.address, 0)
            ).to.be.revertedWithCustomError(debtToken, "ZeroAmount");
        });

        it("Should revert if non-minter tries to mint", async function () {
            const { debtToken, investor1, investor2 } = await loadFixture(deployDebtTokenFixture);

            await expect(
                debtToken.connect(investor1).mint(investor2.address, ethers.parseEther("100"))
            ).to.be.reverted;
        });
    });

    describe("Whitelist Management", function () {
        it("Should allow whitelist admin to add address", async function () {
            const { debtToken, admin, nonWhitelisted } = await loadFixture(deployDebtTokenFixture);

            await debtToken.connect(admin).addToWhitelist(nonWhitelisted.address);
            expect(await debtToken.isWhitelisted(nonWhitelisted.address)).to.be.true;
        });

        it("Should emit InvestorWhitelisted event", async function () {
            const { debtToken, admin, nonWhitelisted } = await loadFixture(deployDebtTokenFixture);

            await expect(debtToken.connect(admin).addToWhitelist(nonWhitelisted.address))
                .to.emit(debtToken, "InvestorWhitelisted");
        });

        it("Should allow batch whitelisting", async function () {
            const { debtToken, admin } = await loadFixture(deployDebtTokenFixture);
            const signers = await ethers.getSigners();

            const addresses = [signers[5].address, signers[6].address, signers[7].address];
            await debtToken.connect(admin).addToWhitelistBatch(addresses);

            for (const addr of addresses) {
                expect(await debtToken.isWhitelisted(addr)).to.be.true;
            }
        });

        it("Should allow removing from whitelist", async function () {
            const { debtToken, admin, investor1 } = await loadFixture(deployDebtTokenFixture);

            await debtToken.connect(admin).removeFromWhitelist(investor1.address);
            expect(await debtToken.isWhitelisted(investor1.address)).to.be.false;
        });

        it("Should emit InvestorRemovedFromWhitelist event", async function () {
            const { debtToken, admin, investor1 } = await loadFixture(deployDebtTokenFixture);

            await expect(debtToken.connect(admin).removeFromWhitelist(investor1.address))
                .to.emit(debtToken, "InvestorRemovedFromWhitelist");
        });

        it("Should revert if non-admin tries to whitelist", async function () {
            const { debtToken, investor1, nonWhitelisted } = await loadFixture(deployDebtTokenFixture);

            await expect(
                debtToken.connect(investor1).addToWhitelist(nonWhitelisted.address)
            ).to.be.reverted;
        });
    });

    describe("Transfer Restrictions", function () {
        it("Should allow transfer between whitelisted addresses after lockup", async function () {
            const { debtToken, vault, investor1, investor2 } = await loadFixture(deployDebtTokenFixture);

            const amount = ethers.parseEther("1000");
            await debtToken.connect(vault).mint(investor1.address, amount);

            // Fast forward past lockup (8 days)
            await time.increase(8 * 24 * 60 * 60);

            await debtToken.connect(investor1).transfer(investor2.address, amount);
            expect(await debtToken.balanceOf(investor2.address)).to.equal(amount);
        });

        it("Should revert transfer during lockup period", async function () {
            const { debtToken, vault, investor1, investor2 } = await loadFixture(deployDebtTokenFixture);

            const amount = ethers.parseEther("1000");
            await debtToken.connect(vault).mint(investor1.address, amount);

            // Try to transfer immediately (within lockup)
            await expect(
                debtToken.connect(investor1).transfer(investor2.address, amount)
            ).to.be.revertedWithCustomError(debtToken, "LockupNotExpired");
        });

        it("Should revert transfer to non-whitelisted address", async function () {
            const { debtToken, vault, investor1, nonWhitelisted } = await loadFixture(deployDebtTokenFixture);

            const amount = ethers.parseEther("1000");
            await debtToken.connect(vault).mint(investor1.address, amount);

            await time.increase(8 * 24 * 60 * 60); // Past lockup

            await expect(
                debtToken.connect(investor1).transfer(nonWhitelisted.address, amount)
            ).to.be.revertedWithCustomError(debtToken, "NotWhitelisted");
        });

        it("canTransfer should return correct value", async function () {
            const { debtToken, vault, investor1 } = await loadFixture(deployDebtTokenFixture);

            await debtToken.connect(vault).mint(investor1.address, ethers.parseEther("100"));

            expect(await debtToken.canTransfer(investor1.address)).to.be.false;

            await time.increase(8 * 24 * 60 * 60);

            expect(await debtToken.canTransfer(investor1.address)).to.be.true;
        });
    });

    describe("Pausing", function () {
        it("Should allow pauser to pause and unpause", async function () {
            const { debtToken, admin, vault, investor1 } = await loadFixture(deployDebtTokenFixture);

            await debtToken.connect(admin).pause();

            const amount = ethers.parseEther("1000");
            await expect(
                debtToken.connect(vault).mint(investor1.address, amount)
            ).to.be.revertedWithCustomError(debtToken, "EnforcedPause");

            await debtToken.connect(admin).unpause();

            await debtToken.connect(vault).mint(investor1.address, amount);
            expect(await debtToken.balanceOf(investor1.address)).to.equal(amount);
        });

        it("Should revert if non-pauser tries to pause", async function () {
            const { debtToken, investor1 } = await loadFixture(deployDebtTokenFixture);

            await expect(debtToken.connect(investor1).pause()).to.be.reverted;
        });
    });

    describe("Burning", function () {
        it("Should allow token holder to burn own tokens", async function () {
            const { debtToken, vault, investor1 } = await loadFixture(deployDebtTokenFixture);

            const amount = ethers.parseEther("1000");
            await debtToken.connect(vault).mint(investor1.address, amount);

            await debtToken.connect(investor1).burn(ethers.parseEther("500"));
            expect(await debtToken.balanceOf(investor1.address)).to.equal(ethers.parseEther("500"));
        });

        it("Should emit TokensBurned when using burnFrom", async function () {
            const { debtToken, admin, vault, investor1 } = await loadFixture(deployDebtTokenFixture);

            const amount = ethers.parseEther("1000");
            await debtToken.connect(vault).mint(investor1.address, amount);

            // Approve admin to burn
            await debtToken.connect(investor1).approve(admin.address, amount);

            await expect(debtToken.connect(admin).burnFrom(investor1.address, amount))
                .to.emit(debtToken, "TokensBurned")
                .withArgs(investor1.address, amount);
        });
    });

    describe("Lockup Period", function () {
        it("Should allow admin to update lockup period", async function () {
            const { debtToken, admin } = await loadFixture(deployDebtTokenFixture);

            const newPeriod = 14 * 24 * 60 * 60; // 14 days
            await debtToken.connect(admin).setLockupPeriod(newPeriod);

            expect(await debtToken.lockupPeriod()).to.equal(newPeriod);
        });

        it("Should emit LockupPeriodUpdated event", async function () {
            const { debtToken, admin } = await loadFixture(deployDebtTokenFixture);

            const oldPeriod = await debtToken.lockupPeriod();
            const newPeriod = 14 * 24 * 60 * 60;

            await expect(debtToken.connect(admin).setLockupPeriod(newPeriod))
                .to.emit(debtToken, "LockupPeriodUpdated")
                .withArgs(oldPeriod, newPeriod);
        });

        it("Should revert if lockup period exceeds 1 year", async function () {
            const { debtToken, admin } = await loadFixture(deployDebtTokenFixture);

            const invalidPeriod = 366 * 24 * 60 * 60; // > 365 days
            await expect(
                debtToken.connect(admin).setLockupPeriod(invalidPeriod)
            ).to.be.revertedWithCustomError(debtToken, "InvalidLockupPeriod");
        });
    });

    describe("Decimals", function () {
        it("Should return 18 decimals", async function () {
            const { debtToken } = await loadFixture(deployDebtTokenFixture);

            expect(await debtToken.decimals()).to.equal(18);
        });
    });
});
