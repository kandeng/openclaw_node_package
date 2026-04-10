/**
 * Robot Plugin Example
 * 
 * This plugin registers tools that delegate to the robot node.
 * The node can be running on the same machine or remotely.
 * 
 * Install in OpenClaw:
 * 1. Copy this directory to ~/.openclaw/plugins/robot_plugin
 * 2. Add "robot_plugin" to openclaw.json plugins.load array
 * 3. Restart OpenClaw gateway
 */

import { createNodePlugin } from "openclaw-node-package/plugin";
import { Type } from "@sinclair/typebox";

export default createNodePlugin({
  // This must match the node name in robot_node/src/index.ts
  nodeId: "physical-robot",
  
  tools: [
    {
      name: "robot_move",
      label: "Move Robot Arm",
      description: `Moves the robot arm to the specified coordinates.

Example usage:
- Move to position (100, 200, 50) at default speed
- Move to home position (0, 0, 0) quickly

The robot will calculate the optimal path and report the actual position after movement.`,
      parameters: {
        x: Type.Number({ 
          description: "X coordinate in millimeters",
          minimum: -500,
          maximum: 500,
        }),
        y: Type.Number({ 
          description: "Y coordinate in millimeters",
          minimum: -500,
          maximum: 500,
        }),
        z: Type.Number({ 
          description: "Z coordinate in millimeters",
          minimum: 0,
          maximum: 300,
        }),
        speed: Type.Optional(Type.Number({ 
          description: "Movement speed (mm/s)",
          default: 50,
          minimum: 1,
          maximum: 100,
        })),
      },
      command: "robot.move",
      timeout: 60000, // 60 seconds max for movement
    },
    
    {
      name: "robot_grab",
      label: "Control Gripper",
      description: `Controls the robot gripper to grab or release objects.

Use "grab" to close the gripper and hold an object.
Use "release" to open the gripper and drop the object.

The force parameter controls how tightly to grip (1-100).`,
      parameters: {
        action: Type.String({ 
          description: "Gripper action",
          enum: ["grab", "release"],
        }),
        force: Type.Optional(Type.Number({ 
          description: "Gripping force (1-100)",
          default: 50,
          minimum: 1,
          maximum: 100,
        })),
      },
      command: "robot.grab",
      timeout: 10000,
    },
    
    {
      name: "robot_status",
      label: "Get Robot Status",
      description: `Retrieves the current status of the robot including:
- Current position (x, y, z coordinates)
- Gripper state (open/closed)
- Battery level
- Connection status

Use this to check if the robot is ready before sending movement commands.`,
      parameters: {},
      command: "robot.status",
      timeout: 5000,
    },
  ],
});
