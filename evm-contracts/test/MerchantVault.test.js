const { expect } = require("chai");
const hre = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const ethers = hre.ethers;

describe("MerchantVault", function () {
    const TARGET_AMOUNT = ethers.parseEther("100000");
    const MIN_INVESTMENT = ethers.parseEther("100");
    const MAX_INVESTMENT = ethers.parseEther("50000");
    const INTEREST_RATE_BPS = 1500;
    const DURATION_MONTHS = 12;
    const NUM_TRANCHES = 4;

    async function deployVaultFixture() {
        const [admin, merchant, feeRecipient, investor1, investor2, investor3, oracle] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 18);
        await mockUSDC.waitForDeployment();

        await mockUSDC.mint(investor1.address, ethers.parseEther("100000"));
        await mockUSDC.mint(investor2.address, ethers.parseEther("100000"));
        await mockUSDC.mint(investor3.address, ethers.parseEther("100000"));
        await mockUSDC.mint(merchant.address, ethers.parseEther("200000"));

        const MilestoneOracleFactory = await ethers.getContractFactory("MilestoneOracle");
        const milestoneOracle = await MilestoneOracleFactory.deploy(admin.address);
        await milestoneOracle.waitForDeployment();

        const fundraisingDeadline = (await time.latest()) + 30 * 24 * 60 * 60;

        const config = {
            targetAmount: TARGET_AMOUNT,
            minInvestment: MIN_INVESTMENT,
            maxInvestment: MAX_INVESTMENT,
            interestRateBps: INTEREST_RATE_BPS,
            durationMonths: DURATION_MONTHS,
            fundraisingDeadline: fundraisingDeadline,
            numTranches: NUM_TRANCHES,
        };

        const VaultFactory = await ethers.getContractFactory("MerchantVault");
        const vault = await VaultFactory.deploy(
            merchant.address,
            await mockUSDC.getAddress(),
            await milestoneOracle.getAddress(),
            admin.address,
            feeRecipient.address,
            config,
            "TigerPay Debt - Test Merchant",
            "TPD-TEST"
        );
        await vault.waitForDeployment();

        const debtTokenAddress = await vault.debtToken();
        const debtToken = await ethers.getContractAt("DebtToken", debtTokenAddress);
        await debtToken.connect(admin).addToWhitelist(investor1.address);
        await debtToken.connect(admin).addToWhitelist(investor2.address);
        await debtToken.connect(admin).addToWhitelist(investor3.address);

        for (let i = 1; i <= NUM_TRANCHES; i++) {
            await milestoneOracle.connect(admin).createMilestone(
                await vault.getAddress(),
                i,
                `Milestone ${i}`
            );
        }

        return { vault, mockUSDC, debtToken, milestoneOracle, admin, merchant, feeRecipient, investor1, investor2, investor3, oracle };
    }

    async function approveMilestone(milestoneOracle, vault, milestoneId, admin, oracle) {
        await milestoneOracle.connect(admin).submitMilestone(
            await vault.getAddress(),
            milestoneId,
            ethers.keccak256(ethers.toUtf8Bytes(`proof${milestoneId}`))
        );

        const VERIFIER_ROLE = await milestoneOracle.VERIFIER_ROLE();
        await milestoneOracle.connect(admin).grantRole(VERIFIER_ROLE, oracle.address);

        await milestoneOracle.connect(admin).voteMilestone(
            await vault.getAddress(),
            milestoneId,
            true,
            "Approved"
        );
        await milestoneOracle.connect(oracle).voteMilestone(
            await vault.getAddress(),
            milestoneId,
            true,
            "Approved"
        );
    }

    describe("Deployment", function () {
        it("Should set correct merchant address", async function () {
            const { vault, merchant } = await loadFixture(deployVaultFixture);
            expect(await vault.merchant()).to.equal(merchant.address);
        });

        it("Should start in FUNDRAISING state", async function () {
            const { vault } = await loadFixture(deployVaultFixture);
            expect(await vault.state()).to.equal(0);
        });

        it("Should initialize correct number of tranches", async function () {
            const { vault } = await loadFixture(deployVaultFixture);
            const tranches = await vault.getTranches();
            expect(tranches.length).to.equal(NUM_TRANCHES);
        });

        it("Should deploy debt token", async function () {
            const { vault } = await loadFixture(deployVaultFixture);
            const debtTokenAddress = await vault.debtToken();
            expect(debtTokenAddress).to.not.equal(ethers.ZeroAddress);
        });

        it("Should revert with zero merchant address", async function () {
            const [admin, _, feeRecipient] = await ethers.getSigners();
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 18);

            const config = {
                targetAmount: TARGET_AMOUNT,
                minInvestment: MIN_INVESTMENT,
                maxInvestment: MAX_INVESTMENT,
                interestRateBps: INTEREST_RATE_BPS,
                durationMonths: DURATION_MONTHS,
                fundraisingDeadline: (await time.latest()) + 30 * 24 * 60 * 60,
                numTranches: NUM_TRANCHES,
            };

            const VaultFactory = await ethers.getContractFactory("MerchantVault");
            const MilestoneOracleFactory = await ethers.getContractFactory("MilestoneOracle");
            const milestoneOracle = await MilestoneOracleFactory.deploy(admin.address);

            await expect(
                VaultFactory.deploy(
                    ethers.ZeroAddress,
                    await mockUSDC.getAddress(),
                    await milestoneOracle.getAddress(),
                    admin.address,
                    feeRecipient.address,
                    config,
                    "Test Token",
                    "TST"
                )
            ).to.be.revertedWithCustomError(VaultFactory, "ZeroAddress");
        });
    });

    describe("Investment", function () {
        it("Should accept valid investment", async function () {
            const { vault, mockUSDC, investor1 } = await loadFixture(deployVaultFixture);

            const investAmount = ethers.parseEther("10000");
            await mockUSDC.connect(investor1).approve(await vault.getAddress(), investAmount);

            await vault.connect(investor1).invest(investAmount);

            expect(await vault.investments(investor1.address)).to.equal(investAmount);
            expect(await vault.totalRaised()).to.equal(investAmount);
        });

        it("Should mint debt tokens to investor", async function () {
            const { vault, mockUSDC, debtToken, investor1 } = await loadFixture(deployVaultFixture);

            const investAmount = ethers.parseEther("10000");
            await mockUSDC.connect(investor1).approve(await vault.getAddress(), investAmount);
            await vault.connect(investor1).invest(investAmount);

            expect(await debtToken.balanceOf(investor1.address)).to.equal(investAmount);
        });

        it("Should emit InvestmentMade event", async function () {
            const { vault, mockUSDC, investor1 } = await loadFixture(deployVaultFixture);

            const investAmount = ethers.parseEther("10000");
            await mockUSDC.connect(investor1).approve(await vault.getAddress(), investAmount);

            await expect(vault.connect(investor1).invest(investAmount))
                .to.emit(vault, "InvestmentMade")
                .withArgs(investor1.address, investAmount, investAmount);
        });

        it("Should revert investment below minimum", async function () {
            const { vault, mockUSDC, investor1 } = await loadFixture(deployVaultFixture);

            const investAmount = ethers.parseEther("50");
            await mockUSDC.connect(investor1).approve(await vault.getAddress(), investAmount);

            await expect(vault.connect(investor1).invest(investAmount))
                .to.be.revertedWithCustomError(vault, "InvestmentTooLow");
        });

        it("Should revert investment above maximum", async function () {
            const { vault, mockUSDC, investor1 } = await loadFixture(deployVaultFixture);

            const investAmount = ethers.parseEther("60000");
            await mockUSDC.connect(investor1).approve(await vault.getAddress(), investAmount);

            await expect(vault.connect(investor1).invest(investAmount))
                .to.be.revertedWithCustomError(vault, "InvestmentTooHigh");
        });

        it("Should complete fundraising when target reached", async function () {
            const { vault, mockUSDC, investor1, investor2 } = await loadFixture(deployVaultFixture);

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor1).invest(ethers.parseEther("50000"));

            await mockUSDC.connect(investor2).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor2).invest(ethers.parseEther("50000"));

            expect(await vault.state()).to.equal(1);
        });
    });

    describe("Fundraising Completion", function () {
        it("Should allow operator to complete fundraising at 80%", async function () {
            const { vault, mockUSDC, admin, investor1, investor2 } = await loadFixture(deployVaultFixture);

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor1).invest(ethers.parseEther("50000"));

            await mockUSDC.connect(investor2).approve(await vault.getAddress(), ethers.parseEther("30000"));
            await vault.connect(investor2).invest(ethers.parseEther("30000"));

            await vault.connect(admin).completeFundraising();

            expect(await vault.state()).to.equal(1);
        });

        it("Should revert completion below 80%", async function () {
            const { vault, mockUSDC, admin, investor1 } = await loadFixture(deployVaultFixture);

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor1).invest(ethers.parseEther("50000"));

            await expect(vault.connect(admin).completeFundraising())
                .to.be.revertedWithCustomError(vault, "FundraisingNotComplete");
        });

        it("Should calculate correct repayment amount", async function () {
            const { vault, mockUSDC, investor1, investor2 } = await loadFixture(deployVaultFixture);

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor1).invest(ethers.parseEther("50000"));

            await mockUSDC.connect(investor2).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor2).invest(ethers.parseEther("50000"));

            const totalToRepay = await vault.totalToRepay();
            expect(totalToRepay).to.equal(ethers.parseEther("115000"));
        });
    });

    describe("Tranche Releases", function () {
        async function fullyFundedFixture() {
            const fixture = await loadFixture(deployVaultFixture);
            const { vault, mockUSDC, investor1, investor2 } = fixture;

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor1).invest(ethers.parseEther("50000"));

            await mockUSDC.connect(investor2).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor2).invest(ethers.parseEther("50000"));

            return fixture;
        }

        it("Should allow admin to release first tranche after milestone approval", async function () {
            const { vault, admin, milestoneOracle } = await fullyFundedFixture();

            await approveMilestone(milestoneOracle, vault, 1, admin, oracle);
            await vault.connect(admin).releaseTranche(0);

            const tranches = await vault.getTranches();
            expect(tranches[0].released).to.be.true;
        });

        it("Should revert releasing tranche without milestone approval", async function () {
            const { vault, admin } = await fullyFundedFixture();

            await expect(vault.connect(admin).releaseTranche(0))
                .to.be.revertedWithCustomError(vault, "MilestoneNotApproved");
        });

        it("Should emit TrancheReleased event", async function () {
            const { vault, admin, milestoneOracle } = await fullyFundedFixture();

            await approveMilestone(milestoneOracle, vault, 1, admin, oracle);

            await expect(vault.connect(admin).releaseTranche(0))
                .to.emit(vault, "TrancheReleased");
        });

        it("Should transfer funds to merchant (minus platform fee)", async function () {
            const { vault, mockUSDC, admin, merchant, milestoneOracle } = await fullyFundedFixture();

            const merchantBalanceBefore = await mockUSDC.balanceOf(merchant.address);

            await approveMilestone(milestoneOracle, vault, 1, admin, oracle);
            await vault.connect(admin).releaseTranche(0);

            const merchantBalanceAfter = await mockUSDC.balanceOf(merchant.address);
            const trancheAmount = ethers.parseEther("25000");
            const expectedFee = trancheAmount * 200n / 10000n;
            const expectedMerchantAmount = trancheAmount - expectedFee;

            expect(merchantBalanceAfter - merchantBalanceBefore).to.equal(expectedMerchantAmount);
        });

        it("Should revert releasing same tranche twice", async function () {
            const { vault, admin, milestoneOracle } = await fullyFundedFixture();

            await approveMilestone(milestoneOracle, vault, 1, admin, oracle);
            await vault.connect(admin).releaseTranche(0);

            await expect(vault.connect(admin).releaseTranche(0))
                .to.be.revertedWithCustomError(vault, "TrancheAlreadyReleased");
        });

        it("Should revert releasing future tranche before time", async function () {
            const { vault, admin } = await fullyFundedFixture();

            await expect(vault.connect(admin).releaseTranche(1))
                .to.be.revertedWithCustomError(vault, "TrancheNotReady");
        });

        it("Should move to REPAYING state after all tranches released", async function () {
            const { vault, admin, milestoneOracle } = await fullyFundedFixture();

            await approveMilestone(milestoneOracle, vault, 1, admin, oracle);
            await vault.connect(admin).releaseTranche(0);

            await time.increase(30 * 24 * 60 * 60);
            await approveMilestone(milestoneOracle, vault, 2, admin, oracle);
            await vault.connect(admin).releaseTranche(1);

            await time.increase(30 * 24 * 60 * 60);
            await approveMilestone(milestoneOracle, vault, 3, admin, oracle);
            await vault.connect(admin).releaseTranche(2);

            await time.increase(30 * 24 * 60 * 60);
            await approveMilestone(milestoneOracle, vault, 4, admin, oracle);
            await vault.connect(admin).releaseTranche(3);

            expect(await vault.state()).to.equal(2);
        });
    });

    describe("Repayments", function () {
        async function activeVaultFixture() {
            const fixture = await loadFixture(deployVaultFixture);
            const { vault, mockUSDC, investor1, investor2, admin, milestoneOracle, oracle } = fixture;

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor1).invest(ethers.parseEther("50000"));

            await mockUSDC.connect(investor2).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor2).invest(ethers.parseEther("50000"));

            await approveMilestone(milestoneOracle, vault, 1, admin, oracle);
            await vault.connect(admin).releaseTranche(0);

            return fixture;
        }

        it("Should accept repayment from merchant", async function () {
            const { vault, mockUSDC, merchant } = await activeVaultFixture();

            const repayAmount = ethers.parseEther("10000");
            await mockUSDC.connect(merchant).approve(await vault.getAddress(), repayAmount);

            await vault.connect(merchant).makeRepayment(repayAmount);

            expect(await vault.totalRepaid()).to.equal(repayAmount);
        });

        it("Should emit RepaymentReceived event", async function () {
            const { vault, mockUSDC, merchant } = await activeVaultFixture();

            const repayAmount = ethers.parseEther("10000");
            await mockUSDC.connect(merchant).approve(await vault.getAddress(), repayAmount);

            await expect(vault.connect(merchant).makeRepayment(repayAmount))
                .to.emit(vault, "RepaymentReceived");
        });

        it("Should move to COMPLETED when fully repaid", async function () {
            const { vault, mockUSDC, merchant, admin, milestoneOracle } = await activeVaultFixture();

            await time.increase(30 * 24 * 60 * 60);
            await approveMilestone(milestoneOracle, vault, 2, admin, oracle);
            await vault.connect(admin).releaseTranche(1);

            await time.increase(30 * 24 * 60 * 60);
            await approveMilestone(milestoneOracle, vault, 3, admin, oracle);
            await vault.connect(admin).releaseTranche(2);

            await time.increase(30 * 24 * 60 * 60);
            await approveMilestone(milestoneOracle, vault, 4, admin, oracle);
            await vault.connect(admin).releaseTranche(3);

            const totalToRepay = await vault.totalToRepay();
            await mockUSDC.connect(merchant).approve(await vault.getAddress(), totalToRepay);
            await vault.connect(merchant).makeRepayment(totalToRepay);

            expect(await vault.state()).to.equal(3);
        });
    });

    describe("Claiming Returns", function () {
        async function repayingVaultFixture() {
            const fixture = await loadFixture(deployVaultFixture);
            const { vault, mockUSDC, investor1, investor2, merchant, admin, milestoneOracle, oracle } = fixture;

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor1).invest(ethers.parseEther("50000"));

            await mockUSDC.connect(investor2).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(investor2).invest(ethers.parseEther("50000"));

            await approveMilestone(milestoneOracle, vault, 1, admin, oracle);
            await vault.connect(admin).releaseTranche(0);

            await time.increase(30 * 24 * 60 * 60);
            await approveMilestone(milestoneOracle, vault, 2, admin, oracle);
            await vault.connect(admin).releaseTranche(1);

            await time.increase(30 * 24 * 60 * 60);
            await approveMilestone(milestoneOracle, vault, 3, admin, oracle);
            await vault.connect(admin).releaseTranche(2);

            await time.increase(30 * 24 * 60 * 60);
            await approveMilestone(milestoneOracle, vault, 4, admin, oracle);
            await vault.connect(admin).releaseTranche(3);

            await mockUSDC.connect(merchant).approve(await vault.getAddress(), ethers.parseEther("50000"));
            await vault.connect(merchant).makeRepayment(ethers.parseEther("50000"));

            return fixture;
        }

        it("Should allow investor to claim proportional returns", async function () {
            const { vault, mockUSDC, investor1 } = await repayingVaultFixture();

            const balanceBefore = await mockUSDC.balanceOf(investor1.address);

            await vault.connect(investor1).claimReturns();

            const balanceAfter = await mockUSDC.balanceOf(investor1.address);

            expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("25000"));
        });

        it("Should emit ReturnsClaimd event", async function () {
            const { vault, investor1 } = await repayingVaultFixture();

            await expect(vault.connect(investor1).claimReturns())
                .to.emit(vault, "ReturnsClaimd");
        });

        it("Should revert if no returns available", async function () {
            const { vault, investor3 } = await repayingVaultFixture();

            await expect(vault.connect(investor3).claimReturns())
                .to.be.revertedWithCustomError(vault, "NoReturnsAvailable");
        });
    });

    describe("Emergency Functions", function () {
        it("Should allow refund after failed fundraising", async function () {
            const { vault, mockUSDC, investor1 } = await loadFixture(deployVaultFixture);

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("10000"));
            await vault.connect(investor1).invest(ethers.parseEther("10000"));

            await time.increase(31 * 24 * 60 * 60);

            const balanceBefore = await mockUSDC.balanceOf(investor1.address);

            await vault.connect(investor1).emergencyRefund();

            const balanceAfter = await mockUSDC.balanceOf(investor1.address);
            expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("10000"));
        });

        it("Should allow operator to pause vault", async function () {
            const { vault, admin, mockUSDC, investor1 } = await loadFixture(deployVaultFixture);

            await vault.connect(admin).pause();

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("1000"));
            await expect(vault.connect(investor1).invest(ethers.parseEther("1000")))
                .to.be.reverted;
        });
    });

    describe("View Functions", function () {
        it("Should return correct vault summary", async function () {
            const { vault, mockUSDC, investor1 } = await loadFixture(deployVaultFixture);

            await mockUSDC.connect(investor1).approve(await vault.getAddress(), ethers.parseEther("10000"));
            await vault.connect(investor1).invest(ethers.parseEther("10000"));

            const summary = await vault.getVaultSummary();

            expect(summary.currentState).to.equal(0);
            expect(summary.raised).to.equal(ethers.parseEther("10000"));
            expect(summary.target).to.equal(TARGET_AMOUNT);
            expect(summary.investorCount).to.equal(1);
        });
    });
});
