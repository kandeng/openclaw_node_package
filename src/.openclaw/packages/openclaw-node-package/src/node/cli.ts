#!/usr/bin/env node
/**
 * CLI entry point for the node package
 */

import { createNode } from "./index.js";

async function main(): Promise<void> {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!token) {
    console.error("Error: OPENCLAW_GATEWAY_TOKEN environment variable is required");
    console.error("Get a token from: openclaw gateway token");
    process.exit(1);
  }

  // Read commands from environment or use defaults
  const commandsEnv = process.env.NODE_COMMANDS;
  const commands = commandsEnv ? commandsEnv.split(",") : ["default.execute"];

  console.log(`Starting OpenClaw Node...`);
  console.log(`Commands: ${commands.join(", ")}`);

  const node = createNode({
    token,
    commands,
    name: process.env.NODE_NAME || "openclaw-node",
    onExecute: async (command: string, payload: unknown) => {
      console.log(`Executing command: ${command}`);
      console.log(`Payload:`, JSON.stringify(payload, null, 2));
      
      return {
        executed: true,
        command,
        timestamp: Date.now(),
        message: "Command executed successfully (default handler)"
      };
    },
  });

  node.on("connected", (info: { protocol: number; methods: string[] }) => {
    console.log(`Connected to gateway (protocol v${info.protocol})`);
  });

  node.on("error", (err: Error) => {
    console.error("Node error:", err.message);
  });

  await node.connect();

  // Keep running
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    node.disconnect();
    process.exit(0);
  });

  await new Promise(() => {});
}

main().catch(console.error);
