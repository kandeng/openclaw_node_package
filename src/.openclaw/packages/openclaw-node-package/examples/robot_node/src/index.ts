#!/usr/bin/env node
/**
 * Robot Node Example
 * 
 * This is a simulated robot node that demonstrates how to:
 * - Connect to OpenClaw gateway
 * - Handle robot movement commands
 * - Handle gripper commands
 * - Report status
 * 
 * Run with: OPENCLAW_GATEWAY_TOKEN=<token> npm start
 */

import { createNode } from "openclaw-node-package/node";

// Simulated robot state
const robotState = {
  position: { x: 0, y: 0, z: 0 },
  gripper: "open",
  connected: true,
  battery: 100,
};

// Simulated hardware delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "ws://localhost:18789";

  if (!token) {
    console.error("❌ Error: OPENCLAW_GATEWAY_TOKEN environment variable is required");
    console.error("   Get a token from: openclaw gateway token");
    process.exit(1);
  }

  console.log("🤖 Robot Node Starting...");
  console.log(`   Gateway: ${gatewayUrl}`);
  console.log(`   Node ID: physical-robot`);

  const node = createNode({
    token,
    gatewayUrl,
    name: "physical-robot",
    commands: ["robot.move", "robot.grab", "robot.status"],
    capabilities: ["robot-arm", "gripper", "6dof"],
    
    onExecute: async (command, payload: any) => {
      console.log(`\n📥 Received command: ${command}`);
      console.log(`   Payload:`, JSON.stringify(payload, null, 2));

      switch (command) {
        case "robot.move": {
          const { x, y, z, speed = 50 } = payload;
          console.log(`   Moving to position (${x}, ${y}, ${z}) at speed ${speed}...`);
          
          // Simulate movement time based on distance
          const distance = Math.sqrt(
            Math.pow(x - robotState.position.x, 2) +
            Math.pow(y - robotState.position.y, 2) +
            Math.pow(z - robotState.position.z, 2)
          );
          const moveTime = (distance / speed) * 1000;
          await delay(Math.min(moveTime, 3000)); // Max 3 seconds for demo
          
          robotState.position = { x, y, z };
          console.log(`   ✅ Movement complete`);
          
          return {
            success: true,
            position: robotState.position,
            duration: moveTime,
          };
        }

        case "robot.grab": {
          const { action, force = 50 } = payload;
          console.log(`   ${action === "grab" ? "Closing" : "Opening"} gripper (force: ${force})...`);
          
          await delay(1000); // Simulate gripper action
          robotState.gripper = action === "grab" ? "closed" : "open";
          console.log(`   ✅ Gripper ${robotState.gripper}`);
          
          return {
            success: true,
            state: robotState.gripper,
            force,
          };
        }

        case "robot.status": {
          console.log(`   Reporting status...`);
          return {
            success: true,
            position: robotState.position,
            gripper: robotState.gripper,
            battery: robotState.battery,
            connected: robotState.connected,
            timestamp: Date.now(),
          };
        }

        default:
          throw new Error(`Unknown command: ${command}`);
      }
    },
  });

  node.on("connected", (info) => {
    console.log(`\n✅ Connected to OpenClaw Gateway`);
    console.log(`   Protocol: v${info.protocol}`);
    console.log(`   Methods: ${info.methods.slice(0, 5).join(", ")}...`);
    console.log(`\n🤖 Robot is ready for commands!`);
    console.log(`   Try: openclaw nodes invoke --node physical-robot --command robot.status`);
  });

  node.on("disconnected", ({ code, message }) => {
    console.log(`\n⚠️  Disconnected from gateway: ${code} ${message}`);
  });

  node.on("error", (err) => {
    console.error(`\n❌ Node error:`, err.message);
  });

  node.on("reconnecting", (attempt, max) => {
    console.log(`\n🔄 Reconnecting (${attempt}/${max})...`);
  });

  // Handle shutdown gracefully
  process.on("SIGINT", () => {
    console.log("\n\n👋 Shutting down robot node...");
    node.disconnect();
    process.exit(0);
  });

  await node.connect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
