# Robot Node & Plugin Example

This example demonstrates how to create a robot control system using the openclaw-node-package.

## Overview

This example consists of two parts:

- **robot_node**: A simulated robot that connects to OpenClaw (runs on the robot or remote machine)
- **robot_plugin**: An OpenClaw plugin that registers robot tools (runs on the OpenClaw host)

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Single Machine Demo                      │
│                                                              │
│  ┌──────────────┐     WebSocket      ┌─────────────────┐     │
│  │  robot_node  │ ─────────────────► │  robot_plugin   │     │
│  │  (port 18789)│                    │  (OpenClaw)     │     │
│  └──────────────┘                    └─────────────────┘     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    Distributed Deployment                     │
│                                                              │
│  ┌──────────────┐      Internet       ┌─────────────────┐    │
│  │  robot_node  │ ◄────────────────►  │  robot_plugin   │    │
│  │  (Robot PC)  │                     │  (OpenClaw Host)│    │
│  └──────────────┘                     └─────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Table of Contents

1. [Quick Start (Single Machine)](#quick-start-single-machine)
2. [Distributed Deployment](#distributed-deployment)
3. [Available Tools](#available-tools)
4. [Testing the Demo](#testing-the-demo)
5. [Customization Guide](#customization-guide)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start (Single Machine)

### Prerequisites

- Node.js 18+ installed
- OpenClaw installed (`npm install -g openclaw`)
- pnpm installed (`npm install -g pnpm`)

### Step 1: Install Dependencies

**Important:** This example uses pnpm workspace dependencies. You must use pnpm, not npm.

```bash
cd ~/.openclaw/packages/openclaw-node-package/examples

# The examples are part of the pnpm workspace
# Dependencies are installed from the workspace root
cd ~/.openclaw
pnpm install
```

### Step 2: Build Required Packages

**Important:** The openclaw-node-package and openclaw-worker-node must be built before running the examples.

```bash
# Build the worker node SDK
cd ~/.openclaw/packages/openclaw-worker-node
pnpm run build

# Build the node package
cd ~/.openclaw/packages/openclaw-node-package
pnpm run build
```

### Step 3: Get Gateway Token

```bash
# Start OpenClaw gateway (if not already running)
openclaw gateway start

# Generate a token
openclaw gateway token
# Copy the token output
```

### Step 4: Start the Robot Node

Terminal 1:
```bash
cd ~/.openclaw/packages/openclaw-node-package/examples/robot_node

export OPENCLAW_GATEWAY_TOKEN="your-token-here"
export OPENCLAW_GATEWAY_URL="ws://localhost:18789"

# Use pnpm to ensure workspace dependencies are resolved
pnpm start
```

**Note:** The node connects using the device identity from `~/.openclaw/identity/device.json`. The node's actual identifier is its device ID, not the `name` parameter. You can see the device ID in the node logs or by running `openclaw nodes list`.

You should see:
```
🤖 Robot Node Starting...
   Gateway: ws://localhost:18789
   Node ID: physical-robot

✅ Connected to OpenClaw Gateway
   Protocol: v3
[physical-robot] Connected to gateway as node
🤖 Robot is ready for commands!
```

### Step 5: Install the Plugin

```bash
# Copy plugin to OpenClaw plugins directory
cp -r ~/.openclaw/packages/openclaw-node-package/examples/robot_plugin \
      ~/.openclaw/plugins/robot_plugin

# Install plugin dependencies (part of workspace)
cd ~/.openclaw
pnpm install
```

Edit `~/.openclaw/openclaw.json`:

**Important:** The plugin ID must match the directory name exactly, and configSchema is required.

```json
{
  "plugins": {
    "enabled": true,
    "allow": [
      "robot_plugin"
    ],
    "load": {
      "paths": [
        "/home/robot/.openclaw/plugins"
      ]
    },
    "entries": {
      "robot_plugin": {
        "enabled": true
      }
    }
  }
}
```

**Plugin Manifest Requirements:**

The plugin's `openclaw.plugin.json` must include:
```json
{
  "id": "robot_plugin",  // Must match directory name
  "configSchema": {      // Required, even if empty
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

The plugin's `package.json` must include:
```json
{
  "main": "src/index.ts",
  "openclaw": {
    "extensions": ["./src/index.ts"]  // Required for TypeScript plugins
  }
}
```

### Step 6: Restart OpenClaw

```bash
# Stop any running gateway
pkill -f "openclaw gateway"

# Start gateway with token authentication
openclaw gateway run --token your-token-here --port 18789
```

**Note:** If you have a systemd service running, stop it first:
```bash
systemctl --user stop openclaw-gateway
systemctl --user disable openclaw-gateway
```

---

## Distributed Deployment

### On OpenClaw Host (Plugin Only)

```bash
# Copy plugin
cp -r examples/robot_plugin ~/.openclaw/plugins/robot_plugin

# Configure openclaw.json
# Add "robot_plugin" to plugins.load

# Restart gateway
openclaw gateway restart
```

### On Robot Machine (Node Only)

```bash
# Copy node to robot
scp -r examples/robot_node robot@robot-pc:~/

# SSH to robot
ssh robot@robot-pc

# Install dependencies
cd ~/robot_node
npm install

# Start node (pointing to OpenClaw host)
export OPENCLAW_GATEWAY_TOKEN="your-token-here"
export OPENCLAW_GATEWAY_URL="ws://openclaw-host-ip:18789"

npm start
```

### Firewall Configuration

Ensure the OpenClaw gateway port (18789) is accessible:

```bash
# On OpenClaw host
sudo ufw allow 18789/tcp
```

---

## Available Tools

### robot_move

Moves the robot arm to specified coordinates.

**Parameters:**
- `x`: X coordinate (-500 to 500 mm)
- `y`: Y coordinate (-500 to 500 mm)  
- `z`: Z coordinate (0 to 300 mm)
- `speed`: Movement speed (1-100 mm/s, default: 50)

**Example:**
```json
{
  "x": 100,
  "y": 200,
  "z": 50,
  "speed": 75
}
```

### robot_grab

Controls the robot gripper.

**Parameters:**
- `action`: "grab" or "release"
- `force`: Gripping force (1-100, default: 50)

**Example:**
```json
{
  "action": "grab",
  "force": 80
}
```

### robot_status

Retrieves robot status.

**Parameters:** None

**Returns:**
```json
{
  "success": true,
  "position": { "x": 0, "y": 0, "z": 0 },
  "gripper": "open",
  "battery": 100,
  "connected": true,
  "timestamp": 1234567890
}
```

---

## Testing the Demo

### Via OpenClaw CLI

**Important:** Nodes are identified by their device ID, not their name. Get the device ID from:
1. The node connection logs
2. Running `openclaw nodes list`
3. The file `~/.openclaw/identity/device.json` (the `deviceId` field)

```bash
# Get robot status (use your actual device ID)
openclaw nodes invoke \
  --node <device-id> \
  --command robot.status

# Move robot
openclaw nodes invoke \
  --node <device-id> \
  --command robot.move \
  --params '{"x":100,"y":50,"z":30}'

# Grab object
openclaw nodes invoke \
  --node <device-id> \
  --command robot.grab \
  --params '{"action":"grab","force":75}'
```

**Note:** You must set `OPENCLAW_GATEWAY_TOKEN` environment variable or include it in your OpenClaw config.

### Via OpenClaw Agent

Once the plugin is loaded, you can simply ask the agent:

```
User: Move the robot to position 100, 200, 50
User: Grab the object on the table
User: What's the robot's current status?
```

The agent will automatically use the registered tools.

---

## Customization Guide

### Adding New Commands

1. Add command handler in `robot_node/src/index.ts`:

```typescript
onExecute: async (command, payload) => {
  switch (command) {
    case "robot.led":
      await setLED(payload.color, payload.brightness);
      return { success: true };
    // ...
  }
}
```

2. Register tool in `robot_plugin/src/index.ts`:

```typescript
{
  name: "robot_led",
  label: "Control LED",
  description: "Controls the robot's LED lights",
  parameters: {
    color: Type.String({ enum: ["red", "green", "blue"] }),
    brightness: Type.Number({ minimum: 0, maximum: 100 }),
  },
  command: "robot.led",
  timeout: 5000,
}
```

### Connecting Real Hardware

Replace the simulated functions in `robot_node/src/index.ts`:

```typescript
// Import your hardware libraries
import { RobotController } from "robot-sdk";

const robot = new RobotController("/dev/ttyUSB0");

onExecute: async (command, payload) => {
  switch (command) {
    case "robot.move":
      await robot.moveTo(payload.x, payload.y, payload.z);
      return { success: true };
    // ...
  }
}
```

---

## Troubleshooting

### Node Won't Connect

**Problem:** Node fails to connect to gateway

**Solutions:**
1. Verify token is valid and matches gateway: `openclaw gateway run --token <token>`
2. Check gateway is running: Check for "listening on ws://..." message
3. Ensure device identity exists: `~/.openclaw/identity/device.json`
4. Use `pnpm start` not `npm start` (workspace dependencies)
5. Check workspace packages are built: `pnpm run build` in package directories

### Plugin Not Loading

**Problem:** Tools don't appear in OpenClaw

**Solutions:**
1. Check plugin `id` in `openclaw.plugin.json` matches directory name exactly
2. Ensure `configSchema` field exists in plugin manifest (required by OpenClaw)
3. Ensure `openclaw.extensions` field exists in `package.json`
4. Check plugin is in `plugins.allow` and `plugins.entries` in `openclaw.json`
5. Restart gateway: Stop and restart with `openclaw gateway run`
6. Check logs: Look for "plugin failed to load" errors in gateway output

### Commands Timeout or "Unknown Node"

**Problem:** Node commands fail with "unknown node" error

**Solutions:**
1. Nodes are identified by device ID, not name. Use `openclaw nodes list` to find the ID
2. Check node is still running and connected
3. Verify WebSocket connection is stable
4. Check gateway logs for node connection messages
5. Increase timeout in plugin tool definition if needed

### Workspace Dependency Errors

**Problem:** "Unsupported URL Type workspace:" error

**Solutions:**
1. Use `pnpm install`, not `npm install`
2. Ensure directory is listed in `pnpm-workspace.yaml`
3. Run `pnpm install` from workspace root (`~/.openclaw`)
4. Build dependent packages: `pnpm run build` in package directories

---

## File Structure

```
examples/
├── robot_node/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts          # Node implementation
│
├── robot_plugin/
│   ├── package.json
│   ├── tsconfig.json
│   ├── openclaw.plugin.json  # Plugin manifest
│   └── src/
│       └── index.ts          # Plugin implementation
│
└── example.md                # This file
```
