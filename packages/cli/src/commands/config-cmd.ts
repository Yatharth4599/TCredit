import { Command } from "commander";
import chalk from "chalk";
import { config } from "../utils/config.js";
import { header, field, divider } from "../utils/display.js";

export const configCommand = new Command("config")
  .description("View or update CLI configuration");

configCommand
  .command("show")
  .description("Show current configuration")
  .action(() => {
    header("KREXA · Configuration");
    field("Network", config.get("network") as string);
    field("RPC URL", config.get("rpcUrl") as string);
    field("API URL", config.get("apiUrl") as string);
    field("Keypair", config.get("keypairPath") as string);
    field("Agent Name", (config.get("agentName") as string) || chalk.dim("not set"));
    field("Agent Type", String(config.get("agentType") ?? 0));
    divider();
    console.log(`  ${chalk.cyan("krexa config set <key> <value>")}`);
    console.log();
  });

configCommand
  .command("set")
  .description("Set a configuration value")
  .argument("<key>", "Config key: network, rpcUrl, apiUrl, keypairPath")
  .argument("<value>", "Value to set")
  .action((key: string, value: string) => {
    const validKeys = ["network", "rpcUrl", "apiUrl", "keypairPath"];
    if (!validKeys.includes(key)) {
      console.log(chalk.red(`  Invalid key: ${key}`));
      console.log(chalk.dim(`  Valid keys: ${validKeys.join(", ")}`));
      return;
    }
    config.set(key, value);
    console.log(chalk.green(`  ✓ ${key} = ${value}`));
  });

// Default action (no subcommand) shows config
configCommand.action(() => {
  header("KREXA · Configuration");
  field("Network", config.get("network") as string);
  field("RPC URL", config.get("rpcUrl") as string);
  field("API URL", config.get("apiUrl") as string);
  field("Keypair", config.get("keypairPath") as string);
  field("Agent Name", (config.get("agentName") as string) || chalk.dim("not set"));
  divider();
  console.log(`  ${chalk.cyan("krexa config set <key> <value>")}`);
  console.log(`  ${chalk.cyan("krexa config show")}`);
  console.log();
});
