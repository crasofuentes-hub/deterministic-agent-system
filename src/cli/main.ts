#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

type CliCommand = "snapshot" | "check-handoffs" | "backup" | "smoke" | "help";

interface CommandDefinition {
  readonly command: CliCommand;
  readonly description: string;
  readonly scriptPath?: string;
}

const COMMANDS: readonly CommandDefinition[] = [
  {
    command: "snapshot",
    description: "Create a live pilot operational snapshot.",
    scriptPath: "scripts/snapshot-live-pilot-ops.ps1",
  },
  {
    command: "check-handoffs",
    description: "Check pending WhatsApp handoffs and fail when open handoffs exist.",
    scriptPath: "scripts/check-whatsapp-handoffs.ps1",
  },
  {
    command: "backup",
    description: "Create a timestamped SQLite backup with checksum manifest.",
    scriptPath: "scripts/backup-live-pilot-sqlite.ps1",
  },
  {
    command: "smoke",
    description: "Run the live pilot operational smoke test.",
    scriptPath: "scripts/smoke-live-pilot.ps1",
  },
  {
    command: "help",
    description: "Show CLI help.",
  },
];

function printHelp(): void {
  console.log("det-agent local CLI");
  console.log("");
  console.log("Usage:");
  console.log("  node dist/src/cli/main.js <command> [script-args...]");
  console.log("");
  console.log("Commands:");

  for (const item of COMMANDS) {
    console.log("  " + item.command.padEnd(16) + item.description);
  }

  console.log("");
  console.log("Examples:");
  console.log("  node dist/src/cli/main.js smoke");
  console.log("  node dist/src/cli/main.js snapshot -SkipBackup");
  console.log("  node dist/src/cli/main.js check-handoffs -AllowOpen");
  console.log("  node dist/src/cli/main.js backup -KeepLast 20");
}

function resolveCommand(value: string | undefined): CommandDefinition {
  const command = (value ?? "help") as CliCommand;
  const found = COMMANDS.find((item) => item.command === command);

  if (!found) {
    console.error("Unknown command: " + String(value));
    console.error("");
    printHelp();
    process.exit(64);
  }

  return found;
}

function runPowerShellScript(scriptPath: string, args: readonly string[]): never {
  const absoluteScriptPath = join(process.cwd(), scriptPath);

  if (!existsSync(absoluteScriptPath)) {
    console.error("Script not found: " + absoluteScriptPath);
    process.exit(66);
  }

  const result = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", absoluteScriptPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: false,
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(result.error.message);
  }

  process.exit(1);
}

function main(argv: readonly string[]): void {
  const [commandValue, ...scriptArgs] = argv;
  const command = resolveCommand(commandValue);

  if (command.command === "help") {
    printHelp();
    return;
  }

  if (!command.scriptPath) {
    console.error("Command is missing script binding: " + command.command);
    process.exit(70);
  }

  runPowerShellScript(command.scriptPath, scriptArgs);
}

main(process.argv.slice(2));
