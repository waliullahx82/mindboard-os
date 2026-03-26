## MCP REST API Endpoints

Base URL: `https://your-app.vercel.app/api/mcp`

---

### List Available Tools

**GET** `/api/mcp/tools`

Returns list of all available MCP tools.

---

### Execute a Tool

**POST** `/api/mcp/execute`

```json
{
  "tool": "list_plans",
  "arguments": {
    "username": "john"
  }
}
```

---

## Tool Examples

### 1. List Plans
```json
POST /api/mcp/execute
{
  "tool": "list_plans",
  "arguments": {
    "username": "john"
  }
}
```

### 2. Get Plan Details
```json
POST /api/mcp/execute
{
  "tool": "get_plan_details",
  "arguments": {
    "username": "john",
    "planId": "abc123"
  }
}
```

### 3. Add Node
```json
POST /api/mcp/execute
{
  "tool": "add_node",
  "arguments": {
    "username": "john",
    "planId": "abc123",
    "title": "Learn React",
    "notes": "Study hooks and state management",
    "state": "learning",
    "color": "y"
  }
}
```

### 4. Update Node
```json
POST /api/mcp/execute
{
  "tool": "update_node",
  "arguments": {
    "username": "john",
    "planId": "abc123",
    "nodeId": "node456",
    "title": "Learn React",
    "notes": "Study hooks and state management",
    "state": "understood"
  }
}
```

### 5. Delete Node
```json
POST /api/mcp/execute
{
  "tool": "delete_node",
  "arguments": {
    "username": "john",
    "planId": "abc123",
    "nodeId": "node456"
  }
}
```

### 6. Add Connection
```json
POST /api/mcp/execute
{
  "tool": "add_connection",
  "arguments": {
    "username": "john",
    "planId": "abc123",
    "fromNodeId": "node1",
    "toNodeId": "node2",
    "type": "related to"
  }
}
```

### 7. Delete Connection
```json
POST /api/mcp/execute
{
  "tool": "delete_connection",
  "arguments": {
    "username": "john",
    "planId": "abc123",
    "connectionId": "conn123"
  }
}
```

### 8. Create Plan
```json
POST /api/mcp/execute
{
  "tool": "create_plan",
  "arguments": {
    "username": "john",
    "planName": "My New Project"
  }
}
```

### 9. Delete Plan
```json
POST /api/mcp/execute
{
  "tool": "delete_plan",
  "arguments": {
    "username": "john",
    "planId": "abc123"
  }
}
```

### 10. Search Nodes
```json
POST /api/mcp/execute
{
  "tool": "search_nodes",
  "arguments": {
    "username": "john",
    "planId": "abc123",
    "query": "react"
  }
}
```

---

## State Values
- `idea` - New idea
- `learning` - Currently learning
- `understood` - Completed understanding
- `shared` - Shared with others

## Color Values
- `y` - Yellow
- `b` - Blue
- `g` - Green
- `p` - Purple
- `o` - Orange
- `r` - Red
- `t` - Teal

## Connection Types
- `depends on`
- `related to`
- `builds upon`
- `leads to`
- `part of`
- `contrast`