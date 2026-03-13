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
import { prisma } from '../config/prisma.js';

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
): Promise<void> {
  await prisma.legalAgreement.update({
    where: { id: agreementId },
    data: {
      status: 'signed',
      txSignature,
      onChainHash,
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
