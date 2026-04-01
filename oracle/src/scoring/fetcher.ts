import { Connection, PublicKey } from "@solana/web3.js";
import type { AgentData } from "./types.js";

// Program IDs
const REGISTRY_PROGRAM = new PublicKey("ChJjAXy7sE4d4jst9VViG7ScanVKqH9Q1cFxtdcH78cG");
const WALLET_PROGRAM = new PublicKey("35t8yWLsUZNTLT71ej7DF59P81HrtZTx2uZeMhwuhhf6");
const VAULT_PROGRAM = new PublicKey("26SQx3rAyujWCupxvPAMf9N3ok4cw1awyTWAVWDQfr9N");
const SCORE_PROGRAM = new PublicKey("2GwtAXnjY5LehfZfT77ZH3XSshwbni8LP9zXeA84WUqh");

// PDA finders
function findPda(seeds: Buffer[], programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
  return pda;
}

// Borsh read helpers
function readPubkey(buf: Buffer, off: number): [PublicKey, number] {
  return [new PublicKey(buf.slice(off, off + 32)), off + 32];
}
function readU8(buf: Buffer, off: number): [number, number] {
  return [buf.readUInt8(off), off + 1];
}
function readU16(buf: Buffer, off: number): [number, number] {
  return [buf.readUInt16LE(off), off + 2];
}
function readU64(buf: Buffer, off: number): [bigint, number] {
  return [buf.readBigUInt64LE(off), off + 8];
}
function readI64(buf: Buffer, off: number): [bigint, number] {
  return [buf.readBigInt64LE(off), off + 8];
}
function readBool(buf: Buffer, off: number): [boolean, number] {
  return [buf.readUInt8(off) !== 0, off + 1];
}

export async function fetchAgentData(
  connection: Connection,
  scorePda: PublicKey,
  programIds?: {
    registry?: PublicKey;
    wallet?: PublicKey;
    vault?: PublicKey;
  }
): Promise<AgentData | null> {
  const registryId = programIds?.registry ?? REGISTRY_PROGRAM;
  const walletId = programIds?.wallet ?? WALLET_PROGRAM;
  const vaultId = programIds?.vault ?? VAULT_PROGRAM;

  // 1. Read KrexitScore PDA to get agent pubkey
  const scoreInfo = await connection.getAccountInfo(scorePda);
  if (!scoreInfo) {
    console.warn(`[Fetcher] Score PDA not found: ${scorePda.toBase58()}`);
    return null;
  }

  const scoreBuf = scoreInfo.data;
  // Skip 8-byte discriminator
  const [agentPubkey] = readPubkey(Buffer.from(scoreBuf), 8);
  // owner is at offset 8+32=40
  // agentType is much further in the struct. For now read what we need:
  // After all the score fields, agentType is at a known offset.
  // Let's just read the first few critical fields.

  // 2. Read AgentProfile PDA from registry
  const profilePda = findPda([Buffer.from("agent_profile"), agentPubkey.toBuffer()], registryId);
  const profileInfo = await connection.getAccountInfo(profilePda);

  let agentType: "Trader" | "Service" | "Hybrid" = "Trader";
  let registeredAt = 0;
  let totalVolume = 0;
  let totalTrades = 0;
  let creditScore = 0;

  if (profileInfo) {
    const buf = Buffer.from(profileInfo.data);
    let off = 8; // skip discriminator
    // agent: Pubkey (32)
    off += 32;
    // owner: Pubkey (32)
    off += 32;
    // ownerType: u8
    off += 1;
    // name: [u8;32]
    off += 32;
    // creditScore: u16
    [creditScore, off] = readU16(buf, off);
    // creditLevel: u8
    off += 1;
    // kyaTier: u8
    off += 1;
    // isActive: bool
    off += 1;
    // registeredAt: i64
    const [regAt] = readI64(buf, off);
    registeredAt = Number(regAt);
    off += 8;
    // skip: lastScoreUpdate(8) + legalAgreementHash(32) + legalAgreementSignedAt(8) + attestationHash(32) + attestationAt(8) + walletPda(32) + liquidationCount(2)
    off += 8 + 32 + 8 + 32 + 8 + 32 + 2;
    // totalVolume: u64
    const [vol] = readU64(buf, off);
    totalVolume = Number(vol);
    off += 8;
    // totalTrades: u64
    const [trades] = readU64(buf, off);
    totalTrades = Number(trades);
    off += 8;
    // totalRepaid: u64
    off += 8;
    // totalBorrowed: u64
    off += 8;
    // agentType: u8
    const [at] = readU8(buf, off);
    agentType = at === 0 ? "Trader" : at === 1 ? "Service" : "Hybrid";
  }

  // 3. Read AgentWallet PDA
  const walletPda = findPda([Buffer.from("agent_wallet"), agentPubkey.toBuffer()], walletId);
  const walletInfo = await connection.getAccountInfo(walletPda);

  let currentDebt = 0;
  let walletValue = 0;
  let creditDrawn = 0;

  if (walletInfo) {
    const buf = Buffer.from(walletInfo.data);
    let off = 8; // skip disc
    // agent(32) + owner(32) + config(32) + walletUsdc(32)
    off += 32 + 32 + 32 + 32;
    // collateralShares: u64
    off += 8;
    // creditLimit: u64
    off += 8;
    // creditDrawn: u64
    const [drawn] = readU64(buf, off);
    creditDrawn = Number(drawn);
    off += 8;
    // totalDebt: u64
    const [debt] = readU64(buf, off);
    currentDebt = Number(debt);
    // walletValue we estimate from creditDrawn for now
    walletValue = creditDrawn;
  }

  // 4. Read CreditLine PDA from vault
  const creditLinePda = findPda([Buffer.from("credit_line"), agentPubkey.toBuffer()], vaultId);
  const creditLineInfo = await connection.getAccountInfo(creditLinePda);

  let originalCredit = 0;
  if (creditLineInfo) {
    const buf = Buffer.from(creditLineInfo.data);
    let off = 8; // skip disc
    // agent: Pubkey (32)
    off += 32;
    // creditLimit: u64
    const [limit] = readU64(buf, off);
    originalCredit = Number(limit);
  }

  // 5. Fetch transaction history for maturity/volume estimation
  let lifetimeVolume = totalVolume;
  let creditCyclesCompleted = 0;

  try {
    const sigs = await connection.getSignaturesForAddress(agentPubkey, { limit: 200 });
    // Estimate account age from oldest transaction
    if (sigs.length > 0 && sigs[sigs.length - 1].blockTime) {
      const oldestTx = sigs[sigs.length - 1].blockTime!;
      if (registeredAt === 0) registeredAt = oldestTx;
    }
    // Rough cycle estimate: every 30 sigs = 1 credit cycle
    creditCyclesCompleted = Math.floor(sigs.length / 30);
  } catch (err) {
    console.warn(`[Fetcher] Failed to fetch signatures for ${agentPubkey.toBase58()}:`, err);
  }

  // If registeredAt is still 0, set it to ~3 months ago as default
  if (registeredAt === 0) {
    registeredAt = Math.floor(Date.now() / 1000) - 90 * 86400;
  }

  return {
    agentPubkey,
    agentType,
    registeredAt,
    repaymentEvents: [], // Would need indexed tx logs — empty for RPC-only approach
    currentDebt,
    walletValue,
    originalCredit,
    cumulativeRevenue: 0,
    cumulativeExpenses: 0,
    dailyPnlHistory: [],
    navHistory: [],
    revenueHealthHistory: [],
    transactions: [],
    creditCyclesCompleted,
    lifetimeVolume,
  };
}
