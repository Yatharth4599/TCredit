import { Command } from "commander";
import chalk from "chalk";
import open from "open";
import { success } from "../utils/display.js";

export const docsCommand = new Command("docs")
  .description("Open Krexa docs in your browser")
  .action(async () => {
    const url = "https://krexa.xyz/docs";
    success(`Opening ${chalk.cyan(url)}`);
    await open(url);
  });
