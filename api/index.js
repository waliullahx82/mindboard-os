import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

// API Routes
app.get('/api/users/:username', async (req, res) => {
  await connectDB();
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const user = await User.findOne({ username: req.params.username });
    if (user) {
      res.json({ exists: true, user: user });
    } else {
      res.json({ exists: false, user: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  await connectDB();
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const { username } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const defaultPlan = {
      id: generateId(),
      name: 'My First Plan',
      createdAt: new Date(),
      nodes: [],
      connections: []
    };
    
    const newUser = new User({
      username,
      plans: [defaultPlan]
    });
    
    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:username', async (req, res) => {
  await connectDB();
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    const { plans, viewState } = req.body;
    const updateData = {
      plans: plans,
      updatedAt: new Date()
    };
    if (viewState) {
      updateData.viewState = viewState;
    }
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      updateData,
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

export default app;