import * as anchor from "@coral-xyz/anchor";
import {
    PublicKey,
    Keypair,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createMint,
    createAssociatedTokenAccount,
    mintTo,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import { assert } from "chai";

describe("TigerPay", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // Use any type to bypass IDL issues
    const program = anchor.workspace.Tigerpay as any;

    // Test accounts
    const authority = provider.wallet.publicKey;
    const feeRecipient = Keypair.generate();
    const merchant = Keypair.generate();
    const investor = Keypair.generate();

    let fundingTokenMint: PublicKey;
    let platformConfigPda: PublicKey;
    let merchantProfilePda: PublicKey;
    let vaultPda: PublicKey;
    let debtTokenMint: PublicKey;
    let vaultTokenAccount: PublicKey;

    const VAULT_NONCE = 0;

    // Helper to get PDAs
    const findPlatformConfig = () =>
        PublicKey.findProgramAddressSync(
            [Buffer.from("config")],
            program.programId
        );

    const findMerchantProfile = (merchant: PublicKey) =>
        PublicKey.findProgramAddressSync(
            [Buffer.from("merchant"), merchant.toBuffer()],
            program.programId
        );

    const findVault = (merchant: PublicKey, nonce: number) =>
        PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), merchant.toBuffer(), Buffer.from([nonce])],
            program.programId
        );

    const findDebtMint = (vault: PublicKey) =>
        PublicKey.findProgramAddressSync(
            [Buffer.from("debt_mint"), vault.toBuffer()],
            program.programId
        );

    const findInvestorAccount = (vault: PublicKey, investor: PublicKey) =>
        PublicKey.findProgramAddressSync(
            [Buffer.from("investor"), vault.toBuffer(), investor.toBuffer()],
            program.programId
        );

    before(async () => {
        console.log("\n🚀 Setting up test environment...");

        // Airdrop SOL to test accounts
        const airdropAmount = 10 * anchor.web3.LAMPORTS_PER_SOL;

        await provider.connection.requestAirdrop(
            merchant.publicKey,
            airdropAmount
        );
        await provider.connection.requestAirdrop(
            investor.publicKey,
            airdropAmount
        );

        // Wait for airdrops
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Create funding token (USDC mock)
        fundingTokenMint = await createMint(
            provider.connection,
            (provider.wallet as anchor.Wallet).payer,
            authority,
            null,
            6
        );

        // Get PDAs
        [platformConfigPda] = findPlatformConfig();
        [merchantProfilePda] = findMerchantProfile(merchant.publicKey);
        [vaultPda] = findVault(merchant.publicKey, VAULT_NONCE);
        [debtTokenMint] = findDebtMint(vaultPda);

        console.log("✓ Test environment ready\n");
    });

    describe("Platform Initialization", () => {
        it("initializes the platform config", async () => {
            await program.methods
                .initializePlatform(
                    200, // 2% fee
                    new anchor.BN(1000_000_000), // 1000 USDC min
                    new anchor.BN(1000000_000_000), // 1M USDC max
                    100, // 1% min interest
                    5000, // 50% max interest
                    24, // 24 months max
                    12, // 12 tranches max
                    2 // 2 verifiers required
                )
                .accounts({
                    authority: authority,
                    feeRecipient: feeRecipient.publicKey,
                    platformConfig: platformConfigPda,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            const config = await program.account.platformConfig.fetch(
                platformConfigPda
            );
            assert.equal(config.defaultFeeBps, 200);
            assert.equal(config.requiredVerifiers, 2);
            assert.equal(config.paused, false);
            console.log("✅ Platform initialized");
        });
    });

    describe("Merchant Verification", () => {
        it("verifies a merchant", async () => {
            const nameHash = Buffer.alloc(32);
            Buffer.from("Test Merchant").copy(nameHash);

            await program.methods
                .verifyMerchant(Array.from(nameHash))
                .accounts({
                    authority: authority,
                    merchant: merchant.publicKey,
                    platformConfig: platformConfigPda,
                    merchantProfile: merchantProfilePda,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            const profile = await program.account.merchantProfile.fetch(
                merchantProfilePda
            );
            assert.equal(profile.verified, true);
            assert.equal(profile.vaultCount, 0);
            console.log("✅ Merchant verified");
        });
    });

    describe("Vault Creation", () => {
        it("creates a vault for verified merchant", async () => {
            // Find associated token account for vault
            vaultTokenAccount = await getAssociatedTokenAddress(
                fundingTokenMint,
                vaultPda,
                true
            );

            await program.methods
                .createVault(
                    VAULT_NONCE,
                    new anchor.BN(100000_000_000), // 100k target
                    new anchor.BN(1000_000_000), // 1k min investment
                    new anchor.BN(50000_000_000), // 50k max investment
                    1500, // 15% interest
                    12, // 12 months
                    4, // 4 tranches
                    30 // 30 days fundraising
                )
                .accounts({
                    authority: authority,
                    merchant: merchant.publicKey,
                    merchantProfile: merchantProfilePda,
                    platformConfig: platformConfigPda,
                    vault: vaultPda,
                    fundingTokenMint: fundingTokenMint,
                    debtTokenMint: debtTokenMint,
                    vaultTokenAccount: vaultTokenAccount,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();

            const vault = await program.account.merchantVault.fetch(vaultPda);
            assert.equal(vault.targetAmount.toNumber(), 100000_000_000);
            assert.equal(vault.interestRateBps, 1500);
            assert.equal(vault.numTranches, 4);
            assert.ok(vault.state.fundraising !== undefined);
            console.log("✅ Vault created");
        });
    });

    describe("Investment", () => {
        it("allows investor to invest in vault", async () => {
            // Create investor token account and mint tokens
            const investorTokenAccount = await createAssociatedTokenAccount(
                provider.connection,
                (provider.wallet as anchor.Wallet).payer,
                fundingTokenMint,
                investor.publicKey
            );

            // Mint 100k USDC to investor
            await mintTo(
                provider.connection,
                (provider.wallet as anchor.Wallet).payer,
                fundingTokenMint,
                investorTokenAccount,
                authority,
                100000_000_000
            );

            const [investorAccountPda] = findInvestorAccount(
                vaultPda,
                investor.publicKey
            );
            const investorDebtTokenAccount = await getAssociatedTokenAddress(
                debtTokenMint,
                investor.publicKey,
                true
            );

            await program.methods
                .invest(new anchor.BN(50000_000_000)) // Invest 50k
                .accounts({
                    investor: investor.publicKey,
                    vault: vaultPda,
                    investorAccount: investorAccountPda,
                    investorTokenAccount: investorTokenAccount,
                    vaultTokenAccount: vaultTokenAccount,
                    debtTokenMint: debtTokenMint,
                    investorDebtTokenAccount: investorDebtTokenAccount,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .signers([investor])
                .rpc();

            const vault = await program.account.merchantVault.fetch(vaultPda);
            assert.equal(vault.totalRaised.toNumber(), 50000_000_000);
            assert.equal(vault.investorCount, 1);

            const investorAcc = await program.account.investorAccount.fetch(
                investorAccountPda
            );
            assert.equal(investorAcc.amountInvested.toNumber(), 50000_000_000);
            console.log("✅ Investment successful - 50k USDC invested");
        });
    });

    describe("Manual Fundraising Completion", () => {
        it("can complete fundraising manually when 80%+ reached", async () => {
            // Get investor token account
            const investorTokenAccount = await getAssociatedTokenAddress(
                fundingTokenMint,
                investor.publicKey,
                true
            );

            // Mint more USDC
            await mintTo(
                provider.connection,
                (provider.wallet as anchor.Wallet).payer,
                fundingTokenMint,
                investorTokenAccount,
                authority,
                50000_000_000
            );

            const [investorAccountPda] = findInvestorAccount(
                vaultPda,
                investor.publicKey
            );
            const investorDebtTokenAccount = await getAssociatedTokenAddress(
                debtTokenMint,
                investor.publicKey,
                true
            );

            // Invest another 30k (total 80k = 80%)
            await program.methods
                .invest(new anchor.BN(30000_000_000))
                .accounts({
                    investor: investor.publicKey,
                    vault: vaultPda,
                    investorAccount: investorAccountPda,
                    investorTokenAccount: investorTokenAccount,
                    vaultTokenAccount: vaultTokenAccount,
                    debtTokenMint: debtTokenMint,
                    investorDebtTokenAccount: investorDebtTokenAccount,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .signers([investor])
                .rpc();

            // Complete fundraising manually
            await program.methods
                .completeFundraisingManual()
                .accounts({
                    authority: authority,
                    vault: vaultPda,
                })
                .rpc();

            const vault = await program.account.merchantVault.fetch(vaultPda);
            assert.ok(vault.state.active !== undefined);
            assert.ok(vault.totalToRepay.toNumber() > 0);
            console.log("✅ Fundraising completed manually");
            console.log(`   Total raised: ${vault.totalRaised.toNumber() / 1e9} USDC`);
            console.log(`   Total to repay: ${vault.totalToRepay.toNumber() / 1e9} USDC`);
        });
    });
});
