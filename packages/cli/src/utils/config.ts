import Conf from "conf";
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const KREXA_DIR = path.join(os.homedir(), ".krexa");
const KEYPAIR_PATH = path.join(KREXA_DIR, "keypair.json");

export const config = new Conf({
  projectName: "krexa",
  schema: {
    network: { type: "string", default: "devnet" },
    rpcUrl: { type: "string", default: "https://api.devnet.solana.com" },
    apiUrl: { type: "string", default: "https://tcredit-backend.onrender.com/api/v1" },
    keypairPath: { type: "string", default: KEYPAIR_PATH },
    agentName: { type: "string", default: "" },
    agentType: { type: "number", default: 0 },
  },
});

export function ensureKrexaDir(): void {
  if (!fs.existsSync(KREXA_DIR)) {
    fs.mkdirSync(KREXA_DIR, { recursive: true });
  }
}

export function keypairExists(): boolean {
  const kpPath = config.get("keypairPath") as string;
  return fs.existsSync(kpPath);
}

export function loadKeypair(): Keypair {
  const kpPath = config.get("keypairPath") as string;
  if (!fs.existsSync(kpPath)) {
    throw new Error(`Keypair not found at ${kpPath}. Run 'krexa init' first.`);
  }
  const raw = JSON.parse(fs.readFileSync(kpPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function saveKeypair(keypair: Keypair): string {
  ensureKrexaDir();
  const kpPath = config.get("keypairPath") as string;
  fs.writeFileSync(kpPath, JSON.stringify(Array.from(keypair.secretKey)));
  fs.chmodSync(kpPath, 0o600);
  return kpPath;
}

export function getRpcUrl(): string {
  return config.get("rpcUrl") as string;
}

export function getApiUrl(): string {
  return config.get("apiUrl") as string;
}

export function getNetwork(): string {
  return config.get("network") as string;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
