import { Command } from "commander";
import chalk from "chalk";
import { config, loadKeypair } from "../utils/config.js";
import { info } from "../utils/display.js";

export const mcpCommand = new Command("mcp")
  .description("Start MCP server mode for Claude Code / Cursor")
  .action(async () => {
    // Set up environment for MCP server
    const keypair = loadKeypair();
    process.env.KREXA_AGENT_ADDRESS = keypair.publicKey.toBase58();
    process.env.KREXA_BASE_URL = config.get("apiUrl") as string;
    process.env.KREXA_CHAIN = "solana";

    // Try to import and start the MCP server
    try {
      // Dynamic import of the MCP server
      const mcpPath = new URL("../../../../mcp-server/dist/index.js", import.meta.url).pathname;
      await import(mcpPath);
    } catch {
      // Fallback: try npx
      console.error(chalk.yellow("MCP server not found locally. Install with:"));
      console.error(chalk.cyan("  claude mcp add krexa --scope user -- npx -y @krexa/cli mcp"));
      console.error();
      info("Or run the standalone MCP server:");
      console.error(chalk.cyan("  npx @krexa/mcp"));
      process.exit(1);
    }
  });
