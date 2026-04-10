#!/usr/bin/env node
/**
 * OpenClaw Node Package - Worker Node Entry Point
 */

import { OpenclawWorkerNode } from "openclaw-worker-node";
export { OpenclawWorkerNode } from "openclaw-worker-node";
export type { WorkerConfig, WorkerInfo } from "openclaw-worker-node";

export interface NodePackageConfig {
  /** Gateway WebSocket URL */
  gatewayUrl?: string;
  /** Auth token */
  token?: string;
  /** Node name */
  name?: string;
  /** Node capabilities */
  capabilities?: string[];
  /** Supported commands */
  commands?: string[];
  /** Identity file path */
  identityPath?: string;
  /** Auto reconnect */
  autoReconnect?: boolean;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
  /** Handler for command execution */
  onExecute?: (command: string, payload: unknown) => Promise<unknown>;
}

/**
 * Create a worker node with the combined package defaults
 */
export function createNode(config: NodePackageConfig): OpenclawWorkerNode {
  if (!config.gatewayUrl || !config.token) {
    throw new Error("gatewayUrl and token are required");
  }

  const worker = new OpenclawWorkerNode({
    gatewayUrl: config.gatewayUrl,
    token: config.token,
    name: config.name || "openclaw-node",
    capabilities: config.capabilities || [],
    commands: config.commands || [],
    identityPath: config.identityPath,
    autoReconnect: config.autoReconnect ?? true,
    maxReconnectAttempts: config.maxReconnectAttempts || 10,
  });

  // Wire up the execute handler if provided
  if (config.onExecute) {
    worker.on("tool.execute", async (payload: any) => {
      const command = payload?.command || "unknown";
      try {
        const result = await config.onExecute!(command, payload);
        await worker.sendResult(payload?.taskId || "unknown", {
          success: true,
          result,
        });
      } catch (err: any) {
        await worker.sendResult(payload?.taskId || "unknown", {
          success: false,
          error: err.message,
        });
      }
    });
  }

  return worker;
}
