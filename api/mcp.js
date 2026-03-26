import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mindboard';

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
}

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

let User;
try {
  User = mongoose.models.User || mongoose.model('User', userSchema);
} catch {
  User = mongoose.model('User', userSchema);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

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

// List all available tools
app.get('/api/mcp/tools', async (req, res) => {
  res.json({
    tools: [
      {
        name: "list_plans",
        description: "List all plans/boards for a user",
        parameters: { username: "string" }
      },
      {
        name: "get_plan_details",
        description: "Get all nodes and connections for a specific plan",
        parameters: { username: "string", planId: "string" }
      },
      {
        name: "add_node",
        description: "Add a new idea or learning node to a specific plan",
        parameters: { username: "string", planId: "string", title: "string", notes: "string", state: "string", color: "string" }
      },
      {
        name: "update_node",
        description: "Update an existing node in a plan",
        parameters: { username: "string", planId: "string", nodeId: "string", title: "string", notes: "string", state: "string", color: "string" }
      },
      {
        name: "delete_node",
        description: "Remove a node from a plan",
        parameters: { username: "string", planId: "string", nodeId: "string" }
      },
      {
        name: "add_connection",
        description: "Connect two nodes in a plan",
        parameters: { username: "string", planId: "string", fromNodeId: "string", toNodeId: "string", type: "string" }
      },
      {
        name: "delete_connection",
        description: "Remove a connection from a plan",
        parameters: { username: "string", planId: "string", connectionId: "string" }
      },
      {
        name: "create_plan",
        description: "Create a new plan/board for a user",
        parameters: { username: "string", planName: "string" }
      },
      {
        name: "delete_plan",
        description: "Delete a plan/board",
        parameters: { username: "string", planId: "string" }
      },
      {
        name: "search_nodes",
        description: "Search nodes by title or notes content",
        parameters: { username: "string", planId: "string", query: "string" }
      }
    ]
  });
});

// Execute a tool
app.post('/api/mcp/execute', async (req, res) => {
  await connectDB();
  
  const { tool, arguments: args } = req.body;
  const { username, planId } = args;
  
  try {
    const user = await getUser(username);
    const plan = planId ? await getPlan(user, planId) : null;
    
    switch (tool) {
      case 'list_plans': {
        const plans = user.plans.map(p => ({
          id: p.id,
          name: p.name,
          nodeCount: p.nodes?.length || 0,
          connectionCount: p.connections?.length || 0,
          createdAt: p.createdAt
        }));
        return res.json({ success: true, result: plans });
      }
      
      case 'get_plan_details': {
        return res.json({ success: true, result: plan });
      }
      
      case 'add_node': {
        const { title, notes, state, color = 'y', x = Math.floor(Math.random() * 800), y = Math.floor(Math.random() * 600) } = args;
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
        return res.json({ success: true, result: newNode });
      }
      
      case 'update_node': {
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
        return res.json({ success: true, result: plan.nodes[nodeIndex] });
      }
      
      case 'delete_node': {
        const { nodeId } = args;
        const nodeIndex = plan.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) throw new Error(`Node '${nodeId}' not found`);
        const deleted = plan.nodes.splice(nodeIndex, 1)[0];
        plan.connections = plan.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
        user.updatedAt = new Date();
        await user.save();
        return res.json({ success: true, result: deleted });
      }
      
      case 'add_connection': {
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
        return res.json({ success: true, result: newConn });
      }
      
      case 'delete_connection': {
        const { connectionId } = args;
        const connIndex = plan.connections.findIndex(c => c.id === connectionId);
        if (connIndex === -1) throw new Error(`Connection '${connectionId}' not found`);
        const deleted = plan.connections.splice(connIndex, 1)[0];
        user.updatedAt = new Date();
        await user.save();
        return res.json({ success: true, result: deleted });
      }
      
      case 'create_plan': {
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
        return res.json({ success: true, result: newPlan });
      }
      
      case 'delete_plan': {
        if (user.plans.length <= 1) throw new Error("Cannot delete the last plan");
        const planIndex = user.plans.findIndex(p => p.id === planId);
        if (planIndex === -1) throw new Error(`Plan '${planId}' not found`);
        const deleted = user.plans.splice(planIndex, 1)[0];
        user.updatedAt = new Date();
        await user.save();
        return res.json({ success: true, result: deleted });
      }
      
      case 'search_nodes': {
        const { query } = args;
        const q = query.toLowerCase();
        const results = plan.nodes.filter(n => 
          n.title?.toLowerCase().includes(q) || 
          n.notes?.toLowerCase().includes(q)
        );
        return res.json({ success: true, result: results });
      }
      
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default app;