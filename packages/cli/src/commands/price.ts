import { Command } from "commander";
import { getApiUrl } from "../utils/config.js";

export const priceCommand = new Command("price")
  .description("Get token price in USD")
  .argument("<token>", "Token symbol (SOL, USDC, etc.)")
  .action(async (token: string) => {
    try {
      const res = await fetch(`${getApiUrl()}/solana/trading/price/${encodeURIComponent(token)}`);
      const data: any = await res.json();
      console.log(`${data.token}: $${data.price ?? 'unknown'}`);
    } catch (err: any) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  });
