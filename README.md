# Openclaw Node Package

## 1. Objective

[Openclaw Nodes](https://docs.openclaw.ai/nodes) are powerful Openclaw peripherals, but difficult to build. 

This package is a javascript SDK that makes it easy to build custom openclaw nodes.
In addition, the package also includes a plugin that automatically discovers and routes tool invocations to authenticated nodes.


&nbsp;
## 2. User scenario

Openclaw nodes provide a secure, persistent bridge between external devices/robots and the Openclaw gateway. 

Openclaw nodes can be deployed either on separate devices or robots, 
or on the same machine as the Openclaw gateway, where they act as a proxy for remote devices and robots.

1. Openclaw vs MCP server
   
   A frequently asked question is: What is the difference between OpenClaw nodes and MCP servers?

    | Feature | OpenClaw Node | MCP Server |
    |------|---------|---------|
    | Protocol | Proprietary WebSocket Handshake | Standardized JSON-RPC (Stdio or HTTP) |
    | Trust Model | Device Pairing: Requires explicit manual approval/code | Configuration: Pre-configured via a file or direct command |
    | Identity | Persistent (Device ID / Name) | Ephemeral (Session-based) |
    | Transport | Network-first (WebSocket) | Local-first (Stdio) or Network (HTTP) |

   For real-time, bi-directional hardware control, OpenClaw nodes are the ideal solution.

   For heavy-lift, easily crashed jobs like 3D object generation, MCP servers are the best bet.
   In addition, it’s better to run these jobs in a Docker sandbox.

2. Custom http/websocket server vs MCP server
  
   Another frequently asked question is: Can we use custom http or websocker server to replace MCP server?

   In most cases, you can replace MCP servers with custom http/websocket servers.
   However, if you want your servers to serve Openclaw, Claude code, and other agents, the MCP server is the best bet.
   Therefore, even though you can use custom http/websocket servers, MCP servers are more preferred.

3. Openclaw-node-package vs Openclaw-node

   This package, `openclaw-node-package`, is inspired by [`openclaw-node`](https://github.com/heypinchy/openclaw-node).
   However, their use cases are different.

   Suppose you want to implement a robot game powered by Openclaw: game engine -> openclaw gateway -> physical robots.

   To integrate the openclaw gateway with the game engine, you use `openclaw-node`.

   To bridge the OpenClaw gateway to physical robots, you use this package, `openclaw-node-package`.


&nbsp;
## 3. File Structure

```
openclaw-node-package/
├── src/
│   ├── node/
│   │   ├── index.ts          # Node factory function (createNode)
│   │   └── cli.ts            # CLI entry point for standalone nodes
│   └── plugin/
│       └── index.ts          # Plugin factory function (createNodePlugin)
├── dist/                     # Compiled output (ESM, CJS, types)
│   ├── node/
│   └── plugin/
├── examples/
│   ├── robot_node/           # Example robot node implementation
│   ├── robot_plugin/         # Example robot plugin implementation
│   └── example.md            # Step-by-step example guide
├── package.json
├── tsconfig.json
└── README.md
```

&nbsp;
## 4. Workflow 

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OpenClaw Gateway                              │
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐  │
│  │   Agent     │───▶│    Tool     │───▶│   Plugin (tool registration)│  │
│  │  (AI/CLI)   │    │  Invocation │    │                             │  │
│  └─────────────┘    └─────────────┘    └──────────────┬──────────────┘  │
│                                                       │                 │
│                                                       │ invokeNode()    │
│                                                       ▼                 │
│                                        ┌─────────────────────────────┐  │
│                                        │   Node (WebSocket)          │  │
│                                        │   - Receives commands       │  │
│                                        │   - Executes work           │  │
│                                        │   - Returns results         │  │
│                                        └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Worker Node Process                             │
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │  WebSocket      │───▶│  Command        │───▶│  Actual Work        │  │
│  │  Connection     │    │  Handler        │    │  (Docker/Hardware)  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

1. **Agent** calls tool (e.g., `robot_move`)
2. **Plugin** receives the call and validates parameters
3. **Plugin** calls `api.invokeNode()` to delegate to the node
4. **Gateway** routes the request to the connected node via WebSocket
5. **Node** receives the command, executes the work
6. **Node** sends result back to gateway
7. **Plugin** receives result and formats it for the agent


&nbsp;
## 5. Single Machine Deployment

In this setup, both the node and plugin run on the same machine as OpenClaw.

### Directory Structure

```
~/.openclaw/
├── nodes/
│   └── my_node/
│       ├── index.ts              # Combined node + plugin code
│       ├── openclaw.plugin.json  # Plugin manifest
│       └── package.json
├── plugins/
│   └── (optional - can use nodes/ version)
└── gateway/                      # OpenClaw gateway runs here
```

### Step 1: Create the Combined Package

Create `nodes/my_node/index.ts`:

```typescript
#!/usr/bin/env node
import { createNode } from "openclaw-node-package/node";
import { createNodePlugin } from "openclaw-node-package/plugin";
import { Type } from "@sinclair/typebox";

// ============ NODE IMPLEMENTATION ============
async function executeWork(params: any) {
  // Your actual implementation here
  console.log("Executing work:", params);
  return { success: true, result: "Work completed" };
}

export function startNode() {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!token) {
    throw new Error("OPENCLAW_GATEWAY_TOKEN required");
  }

  const node = createNode({
    token,
    name: "my-node",
    commands: ["mycommand.execute"],
    capabilities: ["my-capability"],
    onExecute: async (command, payload) => {
      if (command === "mycommand.execute") {
        return executeWork(payload);
      }
      throw new Error(`Unknown command: ${command}`);
    },
  });

  node.on("connected", () => {
    console.log("Node connected to gateway");
  });

  return node.connect();
}

// ============ PLUGIN IMPLEMENTATION ============
export const plugin = createNodePlugin({
  nodeId: "my-node",
  tools: [
    {
      name: "my_tool",
      label: "My Tool",
      description: "Does something useful",
      parameters: {
        input: Type.String({ description: "Input parameter" }),
      },
      command: "mycommand.execute",
      timeout: 30000,
    },
  ],
});

// ============ CLI ENTRY ============
if (import.meta.url === `file://${process.argv[1]}`) {
  startNode().catch(console.error);
}
```

### Step 2: Create Plugin Manifest

Create `nodes/my_node/openclaw.plugin.json`:

```json
{
  "id": "my_node",
  "name": "My Node Plugin",
  "version": "1.0.0",
  "entry": "index.ts",
  "configSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

**Important:** The `id` field must match the directory name exactly. The `configSchema` field is required.

### Step 3: Create Package.json

Create `nodes/my_node/package.json`:

```json
{
  "name": "my-node",
  "version": "1.0.0",
  "type": "module",
  "main": "index.ts",
  "openclaw": {
    "extensions": ["./index.ts"]
  },
  "dependencies": {
    "openclaw-node-package": "workspace:*",
    "@sinclair/typebox": "^0.32.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

**Important:** The `openclaw.extensions` field is required for OpenClaw to discover and load TypeScript plugins.

### Step 4: Add to Workspace (For Development)

If developing within the OpenClaw workspace, add your package to `pnpm-workspace.yaml`:

```yaml
packages:
  - '.'
  - 'plugins/*'
  - 'nodes/*'
  - 'packages/*'
  - 'nodes/my_node'  # Add your node here
```

Then install dependencies:
```bash
cd ~/.openclaw
pnpm install
```

### Step 5: Configure OpenClaw

Add to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "load": ["my_node"]
  }
}
```

### Step 6: Run

Terminal 1 - Start the node:
```bash
cd ~/.openclaw/nodes/my_node
OPENCLAW_GATEWAY_TOKEN=<token> npx tsx index.ts
```

Terminal 2 - OpenClaw gateway will automatically load the plugin.


&nbsp;
## 6. Distributed Deployment (Robot + OpenClaw)

In this setup, the node runs on a physical robot (or remote machine), while the plugin runs with OpenClaw.

### Architecture

```
┌─────────────────────┐         WebSocket         ┌─────────────────────┐
│   Physical Robot    │  ◄──────────────────────► │   OpenClaw Host     │
│                     │                           │                     │
│  ┌───────────────┐  │                           │  ┌───────────────┐  │
│  │  Robot Node   │  │                           │  │  Robot Plugin │  │
│  │  - Hardware   │  │                           │  │  - Tool reg   │  │
│  │    control    │  │                           │  │  - Delegation │  │
│  │  - Sensors    │  │                           │  └───────────────┘  │
│  └───────────────┘  │                           │                     │
└─────────────────────┘                           └─────────────────────┘
     192.168.1.100                                        192.168.1.10
```

### On Physical Robot (Node Only)

Directory structure on robot:

```
~/robot-controller/
├── package.json
├── tsconfig.json
└── src/
    └── robot-node.ts
```

**src/robot-node.ts:**

```typescript
import { createNode } from "openclaw-node-package/node";

// Hardware control imports
import { RobotArm } from "./hardware/arm";
import { Gripper } from "./hardware/gripper";

const arm = new RobotArm();
const gripper = new Gripper();

const node = createNode({
  token: process.env.OPENCLAW_GATEWAY_TOKEN!,
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || "ws://openclaw-host:18789",
  name: "physical-robot",
  commands: ["robot.move", "robot.grab", "robot.status"],
  capabilities: ["robot-arm", "gripper", "sensors"],
  
  onExecute: async (command, payload: any) => {
    switch (command) {
      case "robot.move":
        await arm.moveTo(payload.x, payload.y, payload.z);
        return { success: true, position: await arm.getPosition() };
        
      case "robot.grab":
        if (payload.action === "grab") {
          await gripper.close(payload.force);
        } else {
          await gripper.open();
        }
        return { success: true, state: gripper.getState() };
        
      case "robot.status":
        return {
          success: true,
          arm: await arm.getStatus(),
          gripper: gripper.getState(),
          timestamp: Date.now(),
        };
        
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  },
});

node.on("connected", () => {
  console.log("Robot connected to OpenClaw gateway");
});

node.on("error", (err) => {
  console.error("Robot node error:", err.message);
});

await node.connect();
```

**package.json:**

```json
{
  "name": "robot-controller",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/robot-node.ts"
  },
  "dependencies": {
    "openclaw-node-package": "^1.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.6.0"
  }
}
```

**Run on robot:**

```bash
export OPENCLAW_GATEWAY_URL="ws://192.168.1.10:18789"
export OPENCLAW_GATEWAY_TOKEN="<token-from-openclaw>"
npm start
```

### On OpenClaw Host (Plugin Only)

Directory structure:

```
~/.openclaw/plugins/robot_remote_plugin/
├── openclaw.plugin.json
├── package.json
└── src/
    └── index.ts
```

**src/index.ts:**

```typescript
import { createNodePlugin } from "openclaw-node-package/plugin";
import { Type } from "@sinclair/typebox";

export default createNodePlugin({
  nodeId: "physical-robot",  // Must match node name
  tools: [
    {
      name: "robot_move",
      label: "Move Robot Arm",
      description: "Moves the robot arm to specified coordinates",
      parameters: {
        x: Type.Number({ description: "X coordinate (mm)" }),
        y: Type.Number({ description: "Y coordinate (mm)" }),
        z: Type.Number({ description: "Z coordinate (mm)" }),
        speed: Type.Optional(Type.Number({ default: 50 })),
      },
      command: "robot.move",
      timeout: 60000,
    },
    {
      name: "robot_grab",
      label: "Control Gripper",
      description: "Controls the robot gripper",
      parameters: {
        action: Type.String({ enum: ["grab", "release"] }),
        force: Type.Optional(Type.Number({ default: 50 })),
      },
      command: "robot.grab",
      timeout: 10000,
    },
    {
      name: "robot_status",
      label: "Get Robot Status",
      description: "Retrieves current robot status and sensor readings",
      parameters: {},
      command: "robot.status",
      timeout: 5000,
    },
  ],
});
```

**openclaw.plugin.json:**

```json
{
  "id": "robot_remote_plugin",
  "name": "Remote Robot Controller",
  "version": "1.0.0",
  "entry": "src/index.ts",
  "configSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

**Important:** The `id` must match the directory name, and `configSchema` is required.

**package.json:**

```json
{
  "name": "robot-remote-plugin",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.ts",
  "openclaw": {
    "extensions": ["./src/index.ts"]
  },
  "dependencies": {
    "openclaw-node-package": "workspace:*",
    "@sinclair/typebox": "^0.32.0"
  }
}
```

**Important:** The `openclaw.extensions` field is required for plugin discovery.

**Configure OpenClaw** (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "load": ["robot_remote_plugin"]
  }
}
```

&nbsp;
## 7. Writing Custom Code

### Node Configuration

```typescript
import { createNode } from "openclaw-node-package/node";

const node = createNode({
  // Required
  token: process.env.OPENCLAW_GATEWAY_TOKEN!,  // Gateway auth token
  
  // Optional
  gatewayUrl: "ws://localhost:18789",          // Gateway WebSocket URL
  name: "my-node",                             // Node identifier
  commands: ["cmd1", "cmd2"],                  // Commands this node handles
  capabilities: ["cap1", "cap2"],              // Capabilities advertised
  identityPath: "/custom/path/device.json",    // Custom device identity path
  autoReconnect: true,                         // Reconnect on disconnect
  maxReconnectAttempts: 10,                    // Max reconnection tries
  
  // Handler for command execution
  onExecute: async (command, payload) => {
    // Return any serializable object
    return { success: true, data: "result" };
  },
});
```

### Plugin Configuration

```typescript
import { createNodePlugin } from "openclaw-node-package/plugin";
import { Type } from "@sinclair/typebox";

export default createNodePlugin({
  // Required
  nodeId: "my-node",  // Must match the node's name
  
  // Tool definitions
  tools: [
    {
      name: "tool_name",           // Tool identifier (snake_case)
      label: "Tool Label",         // Display name
      description: "What it does", // For AI context
      parameters: {                // JSON Schema (TypeBox)
        param1: Type.String(),
        param2: Type.Number(),
      },
      command: "cmd1",             // Node command to invoke
      timeout: 30000,              // Execution timeout (ms)
    },
  ],
});
```

### Events

The node emits these events:

```typescript
node.on("connected", (info) => {
  console.log(`Connected (protocol v${info.protocol})`);
  console.log(`Available methods:`, info.methods);
});

node.on("disconnected", (reason) => {
  console.log(`Disconnected: ${reason.code} ${reason.message}`);
});

node.on("error", (err) => {
  console.error("Node error:", err.message);
});

node.on("reconnecting", (attempt, max) => {
  console.log(`Reconnecting (${attempt}/${max})...`);
});
```


&nbsp;
## 8. Build and Installation

### Where is node_modules stored?

**In a pnpm workspace, node_modules are stored in two places:**

1. **Centralized** - All packages share dependencies from the workspace root:
   ```
   ~/.openclaw/node_modules/          # Root workspace dependencies
   ```

2. **Local** - Each package has its own `node_modules` for package-specific links:
   ```
   ~/.openclaw/nodes/my_node/node_modules/     # Local to node
   ~/.openclaw/plugins/my_plugin/node_modules/ # Local to plugin
   ```

### Installing Dependencies

**For workspace packages** (recommended for development):

```bash
# From workspace root
 cd ~/.openclaw

# Install all workspace dependencies
pnpm install

# Add dependency to a specific package
pnpm add --filter my-node some-package

# Add dev dependency
pnpm add -D --filter my-node typescript
```

**For standalone deployment** (robot or production):

```bash
# On the robot machine
cd ~/robot-controller
npm install openclaw-node-package
npm install
```

### Building

**Build the openclaw-node-package itself:**

```bash
cd ~/.openclaw/packages/openclaw-node-package
pnpm run build
```

This creates:
- `dist/node/` - Node exports (ESM, CJS, types)
- `dist/plugin/` - Plugin exports (ESM, CJS, types)

**Build your custom node/plugin:**

If using TypeScript directly (with tsx):
```bash
# No build needed - tsx compiles on-the-fly
npx tsx index.ts
```

If building for distribution:
```bash
cd nodes/my_node
npx tsc
```

### Running

**Development (with tsx):**
```bash
OPENCLAW_GATEWAY_TOKEN=<token> npx tsx index.ts
```

**Production (compiled):**
```bash
OPENCLAW_GATEWAY_TOKEN=<token> node dist/index.js
```

&nbsp;
## 9. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCLAW_GATEWAY_TOKEN` | Yes | Authentication token from OpenClaw |
| `OPENCLAW_GATEWAY_URL` | No | WebSocket URL (default: `ws://localhost:18789`) |
| `NODE_NAME` | No | Override node name |
| `NODE_COMMANDS` | No | Comma-separated list of commands |


&nbsp;
## 10. Troubleshooting

### Node won't connect
- Check `OPENCLAW_GATEWAY_TOKEN` is valid
- Verify `OPENCLAW_GATEWAY_URL` is reachable
- Check firewall rules for WebSocket port (18789)
- Ensure device identity exists at `~/.openclaw/identity/device.json`
- Run `openclaw gateway run --token <token>` to start gateway with token auth

### Plugin can't find node
- Ensure `nodeId` in plugin matches node's `name` parameter
- Verify node is connected to gateway (check for "Connected to gateway as node" message)
- Check gateway logs for connection errors
- Note: Nodes are identified by their device ID, not their name. Use `openclaw nodes list` to see connected nodes

### Plugin not loading
- Plugin `id` in `openclaw.plugin.json` must match directory name exactly
- `configSchema` field is required in plugin manifest (even if empty)
- `openclaw.extensions` field is required in `package.json`
- Add plugin to `plugins.allow` and `plugins.entries` in `openclaw.json`
- Check gateway logs for plugin load errors

### TypeScript errors
- Ensure `type: "module"` in package.json
- Use `.js` extensions in imports (NodeNext resolution)
- Install `@types/node` as dev dependency
- Build packages with `pnpm run build` before running

### Workspace dependency issues
- Use `pnpm install`, not `npm install` (workspace: protocol requires pnpm)
- Add example/node directories to `pnpm-workspace.yaml` if they use workspace: dependencies
- Run `pnpm install` from workspace root after adding new packages


&nbsp;
## 11. Example

Here is [an example with a step-by-step guide](./src/.openclaw/packages/openclaw-node-package/examples/example.md) 
to illustrate how to install and use the openclaw-node-package in a mock distributed deployment.


&nbsp;
## 12. License

MIT

