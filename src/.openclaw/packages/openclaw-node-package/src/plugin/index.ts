/**
 * OpenClaw Node Package - Plugin Entry Point
 * 
 * This is the plugin side of the combined package.
 * It registers tools that delegate to the corresponding node.
 * 
 * Usage in openclaw.json:
 * ```json
 * "my-node-package": {
 *   "enabled": true,
 *   "config": {
 *     "nodeId": "my-node",
 *     "tools": [{
 *       "name": "my_tool",
 *       "label": "My Tool",
 *       "description": "Does something useful",
 *       "parameters": { ... }
 *     }]
 *   }
 * }
 * ```
 */

import { definePluginEntry, emptyPluginConfigSchema } from "openclaw/plugin-sdk/plugin-entry";
import { Type, Static } from "@sinclair/typebox";

export interface ToolDefinition {
  /** Tool name (snake_case) */
  name: string;
  /** Display label */
  label: string;
  /** Description for the AI */
  description: string;
  /** JSON Schema parameters */
  parameters: Record<string, unknown>;
  /** Node command to execute (default: "{name}.execute") */
  command?: string;
  /** Timeout in ms (default: 30000) */
  timeout?: number;
}

export interface NodePluginConfig {
  /** Node ID to delegate to */
  nodeId: string;
  /** Tool definitions */
  tools: ToolDefinition[];
  /** Fallback to direct execution if node unavailable */
  fallback?: boolean;
}

/**
 * Create a plugin that delegates to a node
 */
export function createNodePlugin(config: NodePluginConfig) {
  return definePluginEntry({
    id: `node-${config.nodeId}`,
    name: `${config.nodeId} Node Plugin`,
    description: `Plugin that delegates to ${config.nodeId} node`,
    configSchema: emptyPluginConfigSchema(),

    register(api) {
      const logger = api.logger;

      // Register each tool
      for (const tool of config.tools) {
        const command = tool.command || `${tool.name}.execute`;
        
        api.registerTool({
          name: tool.name,
          label: tool.label,
          description: tool.description,
          parameters: Type.Object(tool.parameters as Record<string, any>),

          async execute(_id, params) {
            const startTime = Date.now();
            logger.info(`[${tool.name}] Delegating to node ${config.nodeId}`);

            try {
              // Try to invoke the node
              const invokeResult = await (api as any).invokeNode?.({
                node: config.nodeId,
                command: command,
                params,
                timeout: tool.timeout || 30000,
              });

              if (invokeResult && typeof invokeResult === "object") {
                const duration = Date.now() - startTime;
                logger.info(`[${tool.name}] Completed in ${duration}ms`);
                
                return {
                  content: [{
                    type: "text" as const,
                    text: JSON.stringify(invokeResult, null, 2),
                  }],
                  details: { ...invokeResult, duration },
                  isError: !invokeResult.success,
                };
              } else {
                throw new Error("Node returned unexpected result");
              }
            } catch (err: any) {
              logger.error(`[${tool.name}] Node invocation failed: ${err.message}`);
              
              return {
                content: [{
                  type: "text" as const,
                  text: `Error: ${err.message}`,
                }],
                details: { error: err.message },
                isError: true,
              };
            }
          },
        });

        logger.info(`Registered tool: ${tool.name} → node:${config.nodeId}/${command}`);
      }

      // Lifecycle hooks
      api.on("gateway_start", async () => {
        logger.info(`Node plugin initialized (node: ${config.nodeId})`);
        logger.info(`Ensure node is running: OPENCLAW_GATEWAY_TOKEN=<token> npx ${config.nodeId}`);
      });
    },
  });
}

// Default export for simple cases
export default createNodePlugin;
