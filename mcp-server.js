import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.error('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  plans: [{
    id: String,
    name: String,
    createdAt: Date,
    nodes: Array,
    connections: Array
  }],
  viewState: {
    vx: { type: Number, default: 0 },
    vy: { type: Number, default: 52 },
    vz: { type: Number, default: 1 },
    activePlanId: { type: String, default: null }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', userSchema);

function uid() {
  return Math.random().toString(36).substring(2, 10);
}

const server = new Server(
  { name: "mindboard-os-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

async function getUser(username) {
  const user = await User.findOne({ username });
  if (!user) throw new Error(`User '${username}' not found`);
  return user;
}

async function getPlan(user, planId) {
  const plan = user.plans.find(p => p.id === planId);
  if (!plan) throw new Error(`Plan with ID '${planId}' not found`);
  return plan;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_plans",
        description: "List all plans/boards for a user",
        inputSchema: {
          type: "object",
          properties: { username: { type: "string", description: "Username" } },
          required: ["username"]
        }
      },
      {
        name: "get_plan_details",
        description: "Get all nodes and connections for a specific plan",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username" },
            planId: { type: "string", description: "Plan ID" }
          },
          required: ["username", "planId"]
        }
      },
      {
        name: "add_node",
        description: "Add a new idea or learning node to a specific plan",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username" },
            planId: { type: "string", description: "Plan ID" },
            title: { type: "string", description: "Title of the node" },
            notes: { type: "string", description: "Detailed notes" },
            state: { type: "string", enum: ["idea", "learning", "understood", "shared"], description: "Status" },
            color: { type: "string", enum: ["y", "b", "g", "p", "o", "r", "t"], description: "Color" },
            x: { type: "number", description: "X position (optional)" },
            y: { type: "number", description: "Y position (optional)" }
          },
          required: ["username", "planId", "title", "notes", "state"]
        }
      },
      {
        name: "update_node",
        description: "Update an existing node in a plan",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username" },
            planId: { type: "string", description: "Plan ID" },
            nodeId: { type: "string", description: "Node ID" },
            title: { type: "string", description: "Title" },
            notes: { type: "string", description: "Notes" },
            state: { type: "string", enum: ["idea", "learning", "understood", "shared"], description: "Status" },
            color: { type: "string", enum: ["y", "b", "g", "p", "o", "r", "t"], description: "Color" },
            done: { type: "boolean", description: "Mark as done" }
          },
          required: ["username", "planId", "nodeId"]
        }
      },
      {
        name: "delete_node",
        description: "Remove a node from a plan",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username" },
            planId: { type: "string", description: "Plan ID" },
            nodeId: { type: "string", description: "Node ID" }
          },
          required: ["username", "planId", "nodeId"]
        }
      },
      {
        name: "add_connection",
        description: "Connect two nodes in a plan",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username" },
            planId: { type: "string", description: "Plan ID" },
            fromNodeId: { type: "string", description: "Source node ID" },
            toNodeId: { type: "string", description: "Target node ID" },
            type: { type: "string", enum: ["depends on", "related to", "builds upon", "leads to", "part of", "contrast"], description: "Connection type" }
          },
          required: ["username", "planId", "fromNodeId", "toNodeId", "type"]
        }
      },
      {
        name: "delete_connection",
        description: "Remove a connection from a plan",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username" },
            planId: { type: "string", description: "Plan ID" },
            connectionId: { type: "string", description: "Connection ID" }
          },
          required: ["username", "planId", "connectionId"]
        }
      },
      {
        name: "create_plan",
        description: "Create a new plan/board for a user",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username" },
            planName: { type: "string", description: "Name of the plan" }
          },
          required: ["username", "planName"]
        }
      },
      {
        name: "delete_plan",
        description: "Delete a plan/board",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username" },
            planId: { type: "string", description: "Plan ID" }
          },
          required: ["username", "planId"]
        }
      },
      {
        name: "search_nodes",
        description: "Search nodes by title or notes content",
        inputSchema: {
          type: "object",
          properties: {
            username: { type: "string", description: "Username" },
            planId: { type: "string", description: "Plan ID" },
            query: { type: "string", description: "Search query" }
          },
          required: ["username", "planId", "query"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const { username, planId } = args;

  try {
    const user = await getUser(username);
    const plan = planId ? await getPlan(user, planId) : null;

    switch (name) {
      case "list_plans": {
        const plans = user.plans.map(p => ({
          id: p.id,
          name: p.name,
          nodeCount: p.nodes?.length || 0,
          connectionCount: p.connections?.length || 0,
          createdAt: p.createdAt
        }));
        return { content: [{ type: "text", text: JSON.stringify(plans, null, 2) }] };
      }

      case "get_plan_details": {
        return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }] };
      }

      case "add_node": {
        const { title, notes, state, color = "y", x = Math.floor(Math.random() * 800), y = Math.floor(Math.random() * 600) } = args;
        const newNode = {
          id: uid(),
          x, y,
          title,
          notes,
          state,
          color,
          rot: (Math.random() - 0.5) * 6,
          checklist: [],
          connections: [],
          done: false,
          crossed: false
        };
        plan.nodes.push(newNode);
        user.updatedAt = new Date();
        await user.save();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, node: newNode }, null, 2) }] };
      }

      case "update_node": {
        const { nodeId, title, notes, state, color, done } = args;
        const nodeIndex = plan.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) throw new Error(`Node '${nodeId}' not found`);
        if (title) plan.nodes[nodeIndex].title = title;
        if (notes) plan.nodes[nodeIndex].notes = notes;
        if (state) plan.nodes[nodeIndex].state = state;
        if (color) plan.nodes[nodeIndex].color = color;
        if (done !== undefined) plan.nodes[nodeIndex].done = done;
        user.updatedAt = new Date();
        await user.save();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, node: plan.nodes[nodeIndex] }, null, 2) }] };
      }

      case "delete_node": {
        const { nodeId } = args;
        const nodeIndex = plan.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) throw new Error(`Node '${nodeId}' not found`);
        const deleted = plan.nodes.splice(nodeIndex, 1)[0];
        plan.connections = plan.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
        user.updatedAt = new Date();
        await user.save();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, deleted }, null, 2) }] };
      }

      case "add_connection": {
        const { fromNodeId, toNodeId, type } = args;
        const fromExists = plan.nodes.find(n => n.id === fromNodeId);
        const toExists = plan.nodes.find(n => n.id === toNodeId);
        if (!fromExists) throw new Error(`Source node '${fromNodeId}' not found`);
        if (!toExists) throw new Error(`Target node '${toNodeId}' not found`);
        const existsConn = plan.connections.find(c => (c.from === fromNodeId && c.to === toNodeId) || (c.from === toNodeId && c.to === fromNodeId));
        if (existsConn) throw new Error("Connection already exists between these nodes");
        const newConn = { id: uid(), from: fromNodeId, to: toNodeId, type };
        plan.connections.push(newConn);
        if (!fromExists.connections) fromExists.connections = [];
        if (!fromExists.connections.includes(toNodeId)) fromExists.connections.push(toNodeId);
        if (!toExists.connections) toExists.connections = [];
        if (!toExists.connections.includes(fromNodeId)) toExists.connections.push(fromNodeId);
        user.updatedAt = new Date();
        await user.save();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, connection: newConn }, null, 2) }] };
      }

      case "delete_connection": {
        const { connectionId } = args;
        const connIndex = plan.connections.findIndex(c => c.id === connectionId);
        if (connIndex === -1) throw new Error(`Connection '${connectionId}' not found`);
        const deleted = plan.connections.splice(connIndex, 1)[0];
        user.updatedAt = new Date();
        await user.save();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, deleted }, null, 2) }] };
      }

      case "create_plan": {
        const { planName } = args;
        const newPlan = {
          id: uid(),
          name: planName,
          createdAt: new Date(),
          nodes: [],
          connections: []
        };
        user.plans.push(newPlan);
        user.updatedAt = new Date();
        await user.save();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, plan: newPlan }, null, 2) }] };
      }

      case "delete_plan": {
        if (user.plans.length <= 1) throw new Error("Cannot delete the last plan");
        const planIndex = user.plans.findIndex(p => p.id === planId);
        if (planIndex === -1) throw new Error(`Plan '${planId}' not found`);
        const deleted = user.plans.splice(planIndex, 1)[0];
        user.updatedAt = new Date();
        await user.save();
        return { content: [{ type: "text", text: JSON.stringify({ success: true, deleted }, null, 2) }] };
      }

      case "search_nodes": {
        const { query } = args;
        const q = query.toLowerCase();
        const results = plan.nodes.filter(n => 
          n.title?.toLowerCase().includes(q) || 
          n.notes?.toLowerCase().includes(q)
        );
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MindBoard OS MCP Server running on stdio");
}

main().catch(console.error);