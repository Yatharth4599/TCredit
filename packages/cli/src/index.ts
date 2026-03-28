#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { scoreCommand } from "./commands/score.js";
import { borrowCommand } from "./commands/borrow.js";
import { repayCommand } from "./commands/repay.js";
import { walletCommand } from "./commands/wallet.js";
import { faucetCommand } from "./commands/faucet.js";
import { lpCommand } from "./commands/lp.js";
import { configCommand } from "./commands/config-cmd.js";
import { mcpCommand } from "./commands/mcp.js";
import { docsCommand } from "./commands/docs.js";

const program = new Command();

program
  .name("krexa")
  .description("Credit layer for AI agents on Solana")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(statusCommand);
program.addCommand(scoreCommand);
program.addCommand(borrowCommand);
program.addCommand(repayCommand);
program.addCommand(walletCommand);
program.addCommand(faucetCommand);
program.addCommand(lpCommand);
program.addCommand(configCommand);
program.addCommand(mcpCommand);
program.addCommand(docsCommand);

program.parse();
