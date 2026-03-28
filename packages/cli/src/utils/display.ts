import chalk from "chalk";
import boxen from "boxen";

export const BANNER = chalk.cyan(`
  ██╗  ██╗██████╗ ███████╗██╗  ██╗ █████╗
  ██║ ██╔╝██╔══██╗██╔════╝╚██╗██╔╝██╔══██╗
  █████╔╝ ██████╔╝█████╗   ╚███╔╝ ███████║
  ██╔═██╗ ██╔══██╗██╔══╝   ██╔██╗ ██╔══██║
  ██║  ██╗██║  ██║███████╗██╔╝ ██╗██║  ██║
  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
`) + chalk.dim("\n  Credit Layer for AI Agents · Solana\n");

export function showBanner(): void {
  console.log(
    boxen(BANNER, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderColor: "cyan",
      borderStyle: "round",
      dimBorder: true,
    })
  );
}

export function success(msg: string): void {
  console.log(chalk.green("  ✓ ") + msg);
}

export function warn(msg: string): void {
  console.log(chalk.yellow("  ⚠ ") + msg);
}

export function error(msg: string): void {
  console.log(chalk.red("  ✗ ") + msg);
}

export function info(msg: string): void {
  console.log(chalk.dim("  ") + msg);
}

export function header(title: string): void {
  console.log();
  console.log(chalk.bold.white(`  ${title}`));
  console.log(chalk.dim("  " + "─".repeat(40)));
}

export function field(label: string, value: string, indent = 2): void {
  const pad = " ".repeat(indent);
  console.log(`${pad}${chalk.dim(label.padEnd(16))}${value}`);
}

export function progressBar(current: number, max: number, width = 20): string {
  const ratio = Math.min(current / max, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(empty));
}

export function healthBadge(hfBps: number): string {
  if (hfBps >= 15_000) return chalk.green("🟢 Green");
  if (hfBps >= 13_000) return chalk.yellow("🟡 Yellow");
  if (hfBps >= 12_000) return chalk.hex("#FF8C00")("🟠 Orange");
  return chalk.red("🔴 Red");
}

export function divider(): void {
  console.log(chalk.dim("  " + "─".repeat(40)));
}
