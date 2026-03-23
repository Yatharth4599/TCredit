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
function encodePubkey(pk: PublicKey): Buffer {
  return Buffer.from(pk.toBytes());
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAILY_UPDATE_INTERVAL = 24 * 60 * 60 * 1000;

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
        filters: [{ dataSize: 1100 }], // Approximate KrexitScore size
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

        const result = computeKrexitScore(agentData);

        console.log(
          `[ScoreUpdater] Computed score for ${agentData.agentPubkey.toBase58()}: ` +
            `${result.score} (L${result.level}) [C1=${result.c1} C2=${result.c2} C3=${result.c3} C4=${result.c4} C5=${result.c5}]`
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

    const result = computeKrexitScore(agentData);

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
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("krexit_score"), agentPubkey.toBuffer()],
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

    // Compute derived metrics with safe defaults
    const pnlRatioBps = Math.round((agentData.pnlRatio ?? 0) * 10000);
    const maxDrawdownBps = Math.min(
      65535,
      Math.round((agentData.maxDrawdown ?? 0) * 10000)
    );
    const sharpeRatioBps = Math.max(
      -32768,
      Math.min(32767, Math.round((agentData.sharpeRatio ?? 0) * 100))
    );
    const greenTimeBps = Math.round((agentData.greenTimePct ?? 0) * 10000);
    const yellowTimeBps = Math.round((agentData.yellowTimePct ?? 0) * 10000);
    const orangeTimeBps = Math.round((agentData.orangeTimePct ?? 0) * 10000);
    const redTimeBps = Math.round((agentData.redTimePct ?? 0) * 10000);
    const venueEntropyBps = Math.round(
      (agentData.venueEntropy ?? 0) * 10000
    );
    const uniqueVenues = agentData.uniqueVenues ?? 0;

    const onTimeRepayments = agentData.repaymentEvents.filter(
      (e) => e.type === "on_time" || e.type === "early"
    ).length;
    const lateRepayments = agentData.repaymentEvents.filter(
      (e) => e.type === "late"
    ).length;
    const missedRepayments = agentData.repaymentEvents.filter(
      (e) => e.type === "missed"
    ).length;
    const liquidations = agentData.repaymentEvents.filter(
      (e) => e.type === "liquidation"
    ).length;
    const defaults = agentData.repaymentEvents.filter(
      (e) => e.type === "default"
    ).length;

    const totalTransactions = agentData.transactions.length;
    const avgDailyVolume =
      agentData.avgDailyVolume ??
      (totalTransactions > 0
        ? agentData.lifetimeVolume / Math.max(1, totalTransactions)
        : 0);

    const updateScoreData = Buffer.concat([
      disc("update_score"),
      encodeU16(result.score),
      encodeU8(result.level),
      encodeU16(result.c1),
      encodeU16(result.c2),
      encodeU16(result.c3),
      encodeU16(result.c4),
      encodeU16(result.c5),
      encodeU32(onTimeRepayments),
      encodeU16(lateRepayments),
      encodeU16(missedRepayments),
      encodeU16(liquidations),
      encodeU16(defaults),
      encodeU32(agentData.creditCyclesCompleted),
      encodeU64(BigInt(Math.max(0, agentData.currentDebt))), // cumulative_borrowed approx
      encodeU64(BigInt(0)), // cumulative_repaid
      encodeU64(BigInt(Math.max(0, agentData.currentDebt))),
      encodeI32(pnlRatioBps),
      encodeU16(maxDrawdownBps),
      encodeI16(sharpeRatioBps),
      encodeU16(greenTimeBps),
      encodeU16(yellowTimeBps),
      encodeU16(orangeTimeBps),
      encodeU16(redTimeBps),
      encodeU16(venueEntropyBps),
      encodeU8(uniqueVenues),
      encodeU32(totalTransactions),
      encodeU64(BigInt(Math.round(avgDailyVolume))),
      encodeU8(eventType),
    ]);

    instructions.push(
      new TransactionInstruction({
        programId: this.programId,
        keys: [
          { pubkey: scoreConfigPda, isSigner: false, isWritable: true },
          { pubkey: scorePda, isSigner: false, isWritable: true },
          { pubkey: this.oracleKeypair.publicKey, isSigner: true, isWritable: false },
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
      encodeU8(result.level),
    ]);

    instructions.push(
      new TransactionInstruction({
        programId: this.registryProgramId,
        keys: [
          { pubkey: registryConfigPda, isSigner: false, isWritable: true },
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
  setInterval(runDaily, DAILY_UPDATE_INTERVAL);

  console.log(
    "[ScoreOracle] Scoring oracle started. Running daily + critical event listener."
  );
}
