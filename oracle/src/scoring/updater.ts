import {
  Connection,
  PublicKey,
  Keypair,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { computeKrexitScore, LIQUIDATION_PENALTY } from "./engine.js";
import { fetchAgentData } from "./fetcher.js";
import { fetchQuickReport, fetchFullReport } from "./fairscale.js";
import type { AgentData, ScoreResult } from "./types.js";

// ── Encoding helpers ─────────────────────────────────────────────────────────

function disc(name: string): Buffer {
  return createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8);
}

function encodeU8(v: number): Buffer {
  const b = Buffer.alloc(1);
  b.writeUInt8(v);
  return b;
}
function encodeU16(v: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v);
  return b;
}
function encodeU32(v: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v);
  return b;
}
function encodeI16(v: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeInt16LE(v);
  return b;
}
function encodeI32(v: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32LE(v);
  return b;
}
function encodeU64(v: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAILY_UPDATE_INTERVAL = 24 * 60 * 60 * 1000;
const KREXIT_SCORE_DATA_SIZE = 648;

const DEFAULT_REGISTRY_PROGRAM = new PublicKey(
  "ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG"
);
const DEFAULT_WALLET_PROGRAM = new PublicKey(
  "35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6"
);
const DEFAULT_VAULT_PROGRAM = new PublicKey(
  "26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N"
);

// ── PDA helpers ──────────────────────────────────────────────────────────────

function findPda(seeds: Buffer[], programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
  return pda;
}

// ── ScoreUpdater ─────────────────────────────────────────────────────────────

export class ScoreUpdater {
  private connection: Connection;
  private oracleKeypair: Keypair;
  private programId: PublicKey;
  private registryProgramId: PublicKey;
  private walletProgramId: PublicKey;
  private vaultProgramId: PublicKey;
  private criticalSubscriptionId: number | null = null;
  private seenCriticalSigs = new Map<string, number>();

  constructor(
    rpcUrl: string,
    oracleKeypair: Keypair,
    programId: PublicKey,
    programIds?: {
      registry?: PublicKey;
      wallet?: PublicKey;
      vault?: PublicKey;
    }
  ) {
    this.connection = new Connection(rpcUrl, "confirmed");
    this.oracleKeypair = oracleKeypair;
    this.programId = programId;
    this.registryProgramId = programIds?.registry ?? DEFAULT_REGISTRY_PROGRAM;
    this.walletProgramId = programIds?.wallet ?? DEFAULT_WALLET_PROGRAM;
    this.vaultProgramId = programIds?.vault ?? DEFAULT_VAULT_PROGRAM;
  }

  async runDailyUpdate(): Promise<void> {
    console.log(
      `[ScoreUpdater] Starting daily update at ${new Date().toISOString()}`
    );

    // Fetch all KrexitScore PDAs via getProgramAccounts
    const allAccounts = await this.connection.getProgramAccounts(
      this.programId,
      {
        filters: [{ dataSize: KREXIT_SCORE_DATA_SIZE }],
      }
    );

    console.log(`[ScoreUpdater] Found ${allAccounts.length} score accounts`);

    for (const account of allAccounts) {
      try {
        const agentData = await fetchAgentData(
          this.connection,
          account.pubkey,
          {
            registry: this.registryProgramId,
            wallet: this.walletProgramId,
            vault: this.vaultProgramId,
          }
        );
        if (!agentData) continue;

        const [agentProfilePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("agent_profile"), agentData.agentPubkey.toBuffer()],
          this.registryProgramId
        );
        if (!agentProfilePda.equals(account.pubkey)) {
          console.warn(
            `[ScoreUpdater] Skipping mismatched score PDA ${account.pubkey.toBase58()} for agent ${agentData.agentPubkey.toBase58()}`
          );
          continue;
        }

        // FairScale — quick report for daily batch
        const pubkey58 = agentData.agentPubkey.toBase58();
        const fsReport = await fetchQuickReport(
          pubkey58,
          agentData.originalCredit || 10_000,
        );

        const result = computeKrexitScore(agentData, fsReport);

        console.log(
          `[ScoreUpdater] ${pubkey58.slice(0, 8)}...: ${result.score} (L${result.level}) ` +
            `[base=${result.fairscaleBase} mod=${result.modifierTotal > 0 ? "+" : ""}${result.modifierTotal}]`
        );

        // Write score on-chain
        await this.writeScoreOnChain(
          agentData.agentPubkey,
          account.pubkey,
          result,
          agentData,
          0 // eventType 0 = daily update
        );
      } catch (error) {
        console.error(
          `[ScoreUpdater] Failed for ${account.pubkey.toBase58()}:`,
          error
        );
      }
    }
  }

  private pruneSeenCriticalSigs(nowMs: number): void {
    const cutoff = nowMs - 24 * 60 * 60 * 1000;
    for (const [sig, ts] of this.seenCriticalSigs.entries()) {
      if (ts < cutoff) this.seenCriticalSigs.delete(sig);
    }
  }

  private async getCurrentScore(scorePda: PublicKey): Promise<number> {
    const info = await this.connection.getAccountInfo(scorePda, "confirmed");
    if (!info || info.data.length < 74) return 350;
    return info.data.readUInt16LE(72); // 8 disc + 32 agentProfile + 32 owner
  }

  private async handleLiquidationSignature(signature: string): Promise<void> {
    const tx = await this.connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx || tx.meta?.err) return;

    const maybeAccountKeys =
      "getAccountKeys" in tx.transaction.message
        ? tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses })
        : null;
    if (!maybeAccountKeys) return;
    const accountKeys: PublicKey[] = maybeAccountKeys
      ? Array.from({ length: maybeAccountKeys.length }, (_, i) => maybeAccountKeys.get(i))
          .filter((k): k is PublicKey => !!k)
      : [];

    const liquidateDisc = disc("liquidate");
    for (const ix of tx.transaction.message.compiledInstructions) {
      const programId = accountKeys[ix.programIdIndex];
      if (!programId || !programId.equals(this.walletProgramId)) continue;
      if (ix.accountKeyIndexes.length < 2) continue;

      const data = typeof ix.data === "string" ? Buffer.from(ix.data, "base64") : Buffer.from(ix.data);
      if (data.length < 8 || !data.subarray(0, 8).equals(liquidateDisc)) continue;

      const agentWalletPda = accountKeys[ix.accountKeyIndexes[1]];
      if (!agentWalletPda) continue;
      const walletInfo = await this.connection.getAccountInfo(agentWalletPda, "confirmed");
      if (!walletInfo || walletInfo.data.length < 40) continue;
      const agentPubkey = new PublicKey(walletInfo.data.subarray(8, 40)); // AgentWallet.agent

      const scorePda = this.findScorePda(agentPubkey);
      const currentScore = await this.getCurrentScore(scorePda);
      await this.handleCriticalEvent(agentPubkey, 5, currentScore); // score_event_type::LIQUIDATION
      return;
    }
  }

  startCriticalEventListener(): void {
    if (this.criticalSubscriptionId !== null) return;

    this.criticalSubscriptionId = this.connection.onLogs(
      this.walletProgramId,
      async (logInfo) => {
        const isLiquidation = logInfo.logs.some(
          (l) => l.includes("Instruction: liquidate") || l.includes("Instruction: Liquidate")
        );
        if (!isLiquidation) return;

        const nowMs = Date.now();
        this.pruneSeenCriticalSigs(nowMs);
        if (this.seenCriticalSigs.has(logInfo.signature)) return;
        this.seenCriticalSigs.set(logInfo.signature, nowMs);

        try {
          await this.handleLiquidationSignature(logInfo.signature);
        } catch (error) {
          console.error(`[ScoreUpdater] Liquidation listener failed for ${logInfo.signature}:`, error);
        }
      },
      "confirmed"
    );
  }

  async handleCriticalEvent(
    agentPubkey: PublicKey,
    eventType: number,
    currentScore: number
  ): Promise<void> {
    console.log(
      `[ScoreUpdater] Critical event type=${eventType} for ${agentPubkey.toBase58()}`
    );

    const scorePda = this.findScorePda(agentPubkey);
    const agentData = await fetchAgentData(this.connection, scorePda, {
      registry: this.registryProgramId,
      wallet: this.walletProgramId,
      vault: this.vaultProgramId,
    });
    if (!agentData) throw new Error("Agent data not found");

    // FairScale — full report for critical events
    const fsReport = await fetchFullReport(
      agentPubkey.toBase58(),
      agentData.originalCredit || 10_000,
    );

    const result = computeKrexitScore(agentData, fsReport);

    // Enforce -40 penalty for liquidation/winddown
    if (eventType === 5 || eventType === 12) {
      const penalizedScore = Math.max(200, currentScore - LIQUIDATION_PENALTY);
      result.score = Math.min(result.score, penalizedScore);
    }

    console.log(
      `[ScoreUpdater] Critical event result: ${currentScore} -> ${result.score}`
    );

    // Write score on-chain
    await this.writeScoreOnChain(
      agentPubkey,
      scorePda,
      result,
      agentData,
      eventType
    );
  }

  findScorePda(agentPubkey: PublicKey): PublicKey {
    const [agentProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent_profile"), agentPubkey.toBuffer()],
      this.registryProgramId
    );
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("krexit_score"), agentProfilePda.toBuffer()],
      this.programId
    );
    return pda;
  }

  // ── On-chain score writing ─────────────────────────────────────────────────

  private async writeScoreOnChain(
    agentPubkey: PublicKey,
    scorePda: PublicKey,
    result: ScoreResult,
    agentData: AgentData,
    eventType: number
  ): Promise<void> {
    const instructions: TransactionInstruction[] = [];

    // 1. Build update_score instruction on krexit-score program
    const scoreConfigPda = findPda(
      [Buffer.from("score_config")],
      this.programId
    );

    // Pack FairScale base + modifier into legacy c1/c2 slots.
    // Program requires c1..c5 <= 10000.
    const fairscaleBaseBps = Math.max(0, Math.min(10_000, result.fairscaleBase));
    const modifierAsBps = Math.max(0, Math.min(10_000, Math.round((result.modifierTotal + 200) * 25)));

    const updateScoreData = Buffer.concat([
      disc("update_score"),
      encodeU16(result.score),
      encodeU8(result.level),
      encodeU16(fairscaleBaseBps),    // legacy c1 slot → fairscale base
      encodeU16(modifierAsBps),       // legacy c2 slot → modifier proxy
      encodeU16(0),                   // legacy c3 slot → unused
      encodeU16(0),                   // legacy c4 slot → unused
      encodeU16(0),                   // legacy c5 slot → unused
      encodeU8(eventType),
      encodeI32(0),                   // legacy pnlRatio → unused
      encodeU16(0),                   // legacy maxDrawdown → unused
      encodeI16(0),                   // legacy sharpeRatio → unused
      encodeU16(0),                   // legacy greenTime → unused
      encodeU16(0),                   // legacy yellowTime → unused
      encodeU16(0),                   // legacy orangeTime → unused
      encodeU16(0),                   // legacy redTime → unused
      encodeU16(0),                   // legacy venueEntropy → unused
      encodeU8(0),                    // legacy uniqueVenues → unused
      encodeU64(BigInt(0)),           // legacy avgDailyVolume → unused
      encodeU16(0),                   // revenueHealthBps
      encodeU16(0),                   // milestoneCompletionRateBps
    ]);

    instructions.push(
      new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: scoreConfigPda, isSigner: false, isWritable: false },
          { pubkey: this.oracleKeypair.publicKey, isSigner: true, isWritable: false },
          { pubkey: scorePda, isSigner: false, isWritable: true },
        ],
        data: updateScoreData,
      })
    );

    // 2. Build update_credit_score instruction on agent-registry program
    const registryConfigPda = findPda(
      [Buffer.from("registry_config")],
      this.registryProgramId
    );
    const agentProfilePda = findPda(
      [Buffer.from("agent_profile"), agentPubkey.toBuffer()],
      this.registryProgramId
    );

    const updateCreditScoreData = Buffer.concat([
      disc("update_credit_score"),
      encodeU16(result.score),
    ]);

    instructions.push(
      new TransactionInstruction({
        programId: this.registryProgramId,
        keys: [
          { pubkey: registryConfigPda, isSigner: false, isWritable: false },
          { pubkey: agentProfilePda, isSigner: false, isWritable: true },
          { pubkey: this.oracleKeypair.publicKey, isSigner: true, isWritable: false },
        ],
        data: updateCreditScoreData,
      })
    );

    // 3. Send transaction
    try {
      const { blockhash } = await this.connection.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: this.oracleKeypair.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const tx = new VersionedTransaction(messageV0);
      tx.sign([this.oracleKeypair]);

      const sig = await this.connection.sendTransaction(tx, {
        skipPreflight: false,
      });
      console.log(
        `[ScoreUpdater] On-chain update tx: ${sig} for agent ${agentPubkey.toBase58()}`
      );

      // Wait for confirmation
      await this.connection.confirmTransaction(sig, "confirmed");
      console.log(
        `[ScoreUpdater] Confirmed score update for ${agentPubkey.toBase58()}: ${result.score} (L${result.level})`
      );
    } catch (err) {
      console.error(
        `[ScoreUpdater] Failed to write score on-chain for ${agentPubkey.toBase58()}:`,
        err
      );
      throw err;
    }
  }
}

// ── Entrypoint ───────────────────────────────────────────────────────────────

export async function startScoringOracle(
  rpcUrl: string,
  oracleKeypairPath: string,
  programId: PublicKey,
  programIds?: {
    registry?: PublicKey;
    wallet?: PublicKey;
    vault?: PublicKey;
  },
  oracleKeypairBase58?: string,
): Promise<void> {
  let keypair: Keypair;

  if (oracleKeypairBase58) {
    // Cloud deployment: load from env var (base58-encoded secret key)
    const { default: bs58 } = await import("bs58");
    keypair = Keypair.fromSecretKey(bs58.decode(oracleKeypairBase58));
  } else {
    // Local development: load from file path
    const fs = await import("fs");
    const raw = fs.readFileSync(oracleKeypairPath, "utf-8");
    keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }

  const updater = new ScoreUpdater(rpcUrl, keypair, programId, programIds);

  const runDaily = async () => {
    try {
      await updater.runDailyUpdate();
    } catch (error) {
      console.error("[ScoreOracle] Daily update failed:", error);
    }
  };

  await runDaily();
  updater.startCriticalEventListener();
  setInterval(runDaily, DAILY_UPDATE_INTERVAL);

  console.log(
    "[ScoreOracle] Scoring oracle started. Running daily updates + liquidation critical-event listener."
  );
}
