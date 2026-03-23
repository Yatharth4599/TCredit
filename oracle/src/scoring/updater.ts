import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { computeKrexitScore, LIQUIDATION_PENALTY } from "./engine.js";
import type { AgentData } from "./types.js";

const DAILY_UPDATE_INTERVAL = 24 * 60 * 60 * 1000;

export class ScoreUpdater {
  private connection: Connection;
  private oracleKeypair: Keypair;
  private programId: PublicKey;

  constructor(rpcUrl: string, oracleKeypair: Keypair, programId: PublicKey) {
    this.connection = new Connection(rpcUrl, "confirmed");
    this.oracleKeypair = oracleKeypair;
    this.programId = programId;
  }

  async runDailyUpdate(): Promise<void> {
    console.log(`[ScoreUpdater] Starting daily update at ${new Date().toISOString()}`);

    // Fetch all KrexitScore PDAs via getProgramAccounts
    const allAccounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [{ dataSize: 1100 }], // Approximate KrexitScore size
    });

    console.log(`[ScoreUpdater] Found ${allAccounts.length} score accounts`);

    for (const account of allAccounts) {
      try {
        const agentData = await this.fetchAgentData(account.pubkey);
        if (!agentData) continue;

        const result = computeKrexitScore(agentData);

        console.log(
          `[ScoreUpdater] Computed score for ${agentData.agentPubkey.toBase58()}: ` +
          `${result.score} (L${result.level}) [C1=${result.c1} C2=${result.c2} C3=${result.c3} C4=${result.c4} C5=${result.c5}]`
        );

        // TODO: Submit on-chain update via Anchor program.methods.updateScore(...)
        // This requires the program IDL to be available
      } catch (error) {
        console.error(`[ScoreUpdater] Failed for ${account.pubkey.toBase58()}:`, error);
      }
    }
  }

  async handleCriticalEvent(
    agentPubkey: PublicKey,
    eventType: number,
    currentScore: number,
  ): Promise<void> {
    console.log(
      `[ScoreUpdater] Critical event type=${eventType} for ${agentPubkey.toBase58()}`
    );

    const agentData = await this.fetchAgentData(agentPubkey);
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

    // TODO: Submit on-chain update
  }

  findScorePda(agentPubkey: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("krexit_score"), agentPubkey.toBuffer()],
      this.programId,
    );
    return pda;
  }

  private async fetchAgentData(_scorePda: PublicKey): Promise<AgentData | null> {
    // TODO: Implement data fetching from:
    // 1. Agent profile (Agent Registry program)
    // 2. Wallet state (Agent Wallet program)
    // 3. Repayment events (parsed from transaction logs)
    // 4. NAV snapshots (keeper database)
    // 5. Daily P&L calculations (keeper database)
    // 6. Transaction venue mapping (on-chain signatures)
    // 7. Service plan data (Service Plan program)
    //
    // For soft launch: use a PostgreSQL database maintained by the keeper bot
    // For scale: use Helius, Triton, or custom Geyser plugin

    console.warn(`[ScoreUpdater] fetchAgentData not yet implemented for ${_scorePda.toBase58()}`);
    return null;
  }
}

export async function startScoringOracle(
  rpcUrl: string,
  oracleKeypairPath: string,
  programId: PublicKey,
): Promise<void> {
  const fs = await import("fs");
  const raw = fs.readFileSync(oracleKeypairPath, "utf-8");
  const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));

  const updater = new ScoreUpdater(rpcUrl, keypair, programId);

  const runDaily = async () => {
    try {
      await updater.runDailyUpdate();
    } catch (error) {
      console.error("[ScoreOracle] Daily update failed:", error);
    }
  };

  await runDaily();
  setInterval(runDaily, DAILY_UPDATE_INTERVAL);

  console.log("[ScoreOracle] Scoring oracle started. Running daily + critical event listener.");
}
