/**
 * Legal Agreement Service — E-signing for L3-L4 credit
 *
 * For credit amounts >$10K (Level 3-4), the agent owner must digitally sign
 * a legal credit agreement. This stores the agreement hash both in the DB
 * and on-chain via the sign_legal_agreement instruction.
 *
 * MVP: typed-signature with timestamp (no DocuSign). The agreement is a
 * template filled with agent pubkey, level, terms, and date.
 */

import { createHash } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import { prisma } from '../config/prisma.js';
import { solanaConnection } from '../chain/solana/connection.js';
import { PROGRAM_IDS, DISCRIMINATORS, agentProfilePda } from '../chain/solana/programs.js';
import { AppError } from '../api/middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// Agreement template
// ---------------------------------------------------------------------------

function generateAgreementText(agentPubkey: string, creditLevel: number): string {
  const date = new Date().toISOString().split('T')[0];
  return [
    'KREXA CREDIT AGREEMENT',
    '',
    `Date: ${date}`,
    `Agent: ${agentPubkey}`,
    `Credit Level: ${creditLevel}`,
    '',
    'TERMS:',
    '1. The undersigned acknowledges that this credit line is issued by the Krexa',
    '   protocol and agrees to the terms of repayment as specified by the on-chain',
    '   credit vault parameters (interest rate, collateral requirements, health factor).',
    '',
    '2. Failure to maintain the required health factor may result in automatic',
    '   deleveraging or liquidation of collateral positions.',
    '',
    '3. The agent owner assumes responsibility for all credit activity performed',
    '   by the registered AI agent, including trades, payments, and x402 transactions.',
    '',
    '4. This agreement is binding for the duration of the active credit line.',
    '   A new agreement may be required for level upgrades.',
    '',
    '5. Credit score and repayment history will be recorded and made available',
    '   through the Krexa Credit Bureau API.',
    '',
    `Krexa Protocol — krexa.xyz`,
  ].join('\n');
}

function hashAgreement(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// ---------------------------------------------------------------------------
// Initiate signing
// ---------------------------------------------------------------------------

export interface AgreementInitResult {
  agreementId: string;
  agreementHash: string;
  agreementText: string;
  creditLevel: number;
  status: 'pending';
  note: string;
}

export async function initiateAgreement(
  agentPubkey: string,
  creditLevel: number,
): Promise<AgreementInitResult> {
  if (creditLevel < 3 || creditLevel > 4) {
    throw new Error('Legal agreement only required for credit levels 3-4');
  }

  const text = generateAgreementText(agentPubkey, creditLevel);
  const agreementHash = hashAgreement(text);

  const agreement = await prisma.legalAgreement.create({
    data: {
      agentPubkey,
      agreementHash,
      creditLevel,
      status: 'pending',
    },
  });

  return {
    agreementId: agreement.id,
    agreementHash,
    agreementText: text,
    creditLevel,
    status: 'pending',
    note: 'Sign this agreement by submitting the on-chain sign_legal_agreement instruction with the agreementHash as [u8; 32]',
  };
}

// ---------------------------------------------------------------------------
// Confirm signing (called after on-chain tx confirms)
// ---------------------------------------------------------------------------

export async function confirmAgreementSigned(
  agreementId: string,
  txSignature: string,
  onChainHash: string,
  agentPubkey: string,
): Promise<void> {
  // BUG-140 fix: verify agreement exists AND belongs to the agent in the URL
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id: agreementId },
  });

  if (!agreement) {
    throw new Error('Agreement not found');
  }
  if (agreement.agentPubkey !== agentPubkey) {
    throw new Error('Agreement does not belong to this agent');
  }
  if (agreement.status === 'signed') {
    throw new Error('Agreement already confirmed');
  }

  // BUG-140 fix: verify onChainHash matches the agreement's hash
  if (onChainHash && onChainHash !== agreement.agreementHash) {
    throw new Error('On-chain hash does not match agreement hash');
  }

  // BUG-140 fix: verify the provided tx actually executed sign_legal_agreement
  // for this agent profile and agreement hash on the registry program.
  const tx = await solanaConnection.getTransaction(txSignature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) {
    throw new AppError(400, 'Transaction not found on-chain');
  }

  const maybeAccountKeys =
    'getAccountKeys' in tx.transaction.message
      ? tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta?.loadedAddresses })
      : null;
  if (!maybeAccountKeys) {
    throw new AppError(400, 'Unsupported transaction message format');
  }
  const accountKeys: PublicKey[] = maybeAccountKeys
    ? Array.from({ length: maybeAccountKeys.length }, (_, i) => maybeAccountKeys.get(i))
        .filter((k): k is PublicKey => !!k)
    : [];

  const expectedProfile = agentProfilePda(new PublicKey(agentPubkey)).toBase58();
  const expectedHash = Buffer.from(agreement.agreementHash, 'hex');
  const expectedDisc = Buffer.from(DISCRIMINATORS.signLegalAgreement);
  let matched = false;

  for (const ix of tx.transaction.message.compiledInstructions) {
    const programId = accountKeys[ix.programIdIndex];
    if (!programId || !programId.equals(PROGRAM_IDS.agentRegistry)) continue;
    const data = typeof ix.data === 'string' ? Buffer.from(ix.data, 'base64') : Buffer.from(ix.data);
    if (data.length < 40) continue;
    if (!data.subarray(0, 8).equals(expectedDisc)) continue;
    if (!data.subarray(8, 40).equals(expectedHash)) continue;

    const accountList = ix.accountKeyIndexes.map((i) => accountKeys[i]?.toBase58()).filter(Boolean);
    if (!accountList.includes(expectedProfile)) continue;
    matched = true;
    break;
  }
  if (!matched) {
    throw new AppError(400, 'Transaction does not contain a valid sign_legal_agreement instruction for this agent/hash');
  }

  await prisma.legalAgreement.update({
    where: { id: agreementId },
    data: {
      status: 'signed',
      txSignature,
      onChainHash: onChainHash || agreement.agreementHash,
      signedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Check status
// ---------------------------------------------------------------------------

export interface AgreementStatus {
  agentPubkey: string;
  hasSignedAgreement: boolean;
  latestAgreement: {
    id: string;
    creditLevel: number;
    status: string;
    agreementHash: string;
    signedAt: string | null;
    txSignature: string | null;
  } | null;
}

export async function getAgreementStatus(agentPubkey: string): Promise<AgreementStatus> {
  const latest = await prisma.legalAgreement.findFirst({
    where: { agentPubkey },
    orderBy: { createdAt: 'desc' },
  });

  return {
    agentPubkey,
    hasSignedAgreement: latest?.status === 'signed',
    latestAgreement: latest ? {
      id: latest.id,
      creditLevel: latest.creditLevel,
      status: latest.status,
      agreementHash: latest.agreementHash,
      signedAt: latest.signedAt?.toISOString() ?? null,
      txSignature: latest.txSignature ?? null,
    } : null,
  };
}
