# 5️⃣ Practical Podman Project

**Duration**: 1.5 hours  
**Mode**: Complete Hands-On Project

---

## 📌 Project Overview

### What We're Building

A **full-stack Todo application** with:
- ✅ **Frontend** - React web interface
- ✅ **Backend** - Node.js REST API  
- ✅ **Database** - PostgreSQL
- ✅ **Cache** - Redis
- ✅ **Reverse Proxy** - Nginx
- ✅ **All containerized** with Podman Compose

### Architecture

```
┌──────────────────────────────────────────────┐
│                                              │
│  Browser → Nginx → Frontend (React)          │
│              ↓                               │
│         Backend API (Node.js)                │
│              ↓          ↓                    │
│         PostgreSQL   Redis                   │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 🏗️ Project Structure

```
todo-app/
├── compose.yaml
├── .env
├── .containerignore
├── frontend/
│   ├── Containerfile
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── TodoList.js
│       └── index.js
├── backend/
│   ├── Containerfile
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── routes/
│       │   └── todos.js
│       └── db/
│           └── init.sql
└── nginx/
    └── nginx.conf
```

---

## 📝 Step 1: Create Project Structure

```bash
# Create project directory
mkdir todo-app && cd todo-app

# Create subdirectories
mkdir -p frontend/src frontend/public
mkdir -p backend/src/routes backend/src/db
mkdir nginx
```

---

## 🔧 Step 2: Backend API (Node.js + Express)

### backend/package.json

```json
{
  "name": "todo-backend",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### backend/src/server.js

```javascript
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'tododb',
});

// Redis connection
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:6379`
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redisClient.ping();
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Get all todos
app.get('/api/todos', async (req, res) => {
  try {
    // Try cache first
    const cached = await redisClient.get('todos');
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Query database
    const result = await pool.query(
      'SELECT * FROM todos ORDER BY created_at DESC'
    );
    
    // Cache result
    await redisClient.setEx('todos', 60, JSON.stringify(result.rows));
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create todo
app.post('/api/todos', async (req, res) => {
  try {
    const { title, description } = req.body;
    const result = await pool.query(
      'INSERT INTO todos (title, description) VALUES ($1, $2) RETURNING *',
      [title, description]
    );
    
    // Invalidate cache
    await redisClient.del('todos');
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update todo
app.put('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed } = req.body;
    const result = await pool.query(
      'UPDATE todos SET title = $1, description = $2, completed = $3 WHERE id = $4 RETURNING *',
      [title, description, completed, id]
    );
    
    // Invalidate cache
    await redisClient.del('todos');
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete todo
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM todos WHERE id = $1', [id]);
    
    // Invalidate cache
    await redisClient.del('todos');
    
    res.json({ message: 'Todo deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
```

### backend/src/db/init.sql

```sql
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data
INSERT INTO todos (title, description) VALUES
  ('Learn Podman', 'Complete Day 4 workshop'),
  ('Build containers', 'Create Containerfiles for frontend and backend'),
  ('Deploy app', 'Use Podman Compose to orchestrate services');
```

### backend/Containerfile

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package.json ./
COPY --chown=nodejs:nodejs src ./src
USER nodejs
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "src/server.js"]
```

---

## ⚛️ Step 3: Frontend (React)

### frontend/package.json

```json
{
  "name": "todo-frontend",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  },
  "proxy": "http://backend:5000"
}
```

### frontend/public/index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Todo App</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

### frontend/src/index.js

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

### frontend/src/App.js

```javascript
import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await fetch('/api/todos');
      const data = await response.json();
      setTodos(data);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };

  const addTodo = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      if (response.ok) {
        setTitle('');
        setDescription('');
        fetchTodos();
      }
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  };

  const toggleTodo = async (todo) => {
    try {
      await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...todo, completed: !todo.completed }),
      });
      fetchTodos();
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  const deleteTodo = async (id) => {
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      fetchTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  return (
    <div className="App">
      <h1>📝 Todo App</h1>
      
      <form onSubmit={addTodo}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Add Todo</button>
      </form>

      <div className="todos">
        {todos.map((todo) => (
          <div key={todo.id} className={`todo ${todo.completed ? 'completed' : ''}`}>
            <h3 onClick={() => toggleTodo(todo)}>{todo.title}</h3>
            <p>{todo.description}</p>
            <button onClick={() => deleteTodo(todo.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
```

### frontend/src/App.css

```css
.App {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
}

form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #0056b3;
}

.todos {
  display: grid;
  gap: 15px;
}

.todo {
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f9f9f9;
}

.todo.completed {
  opacity: 0.6;
  text-decoration: line-through;
}

.todo h3 {
  margin: 0 0 10px 0;
  cursor: pointer;
}

.todo p {
  margin: 0 0 10px 0;
  color: #666;
}
```

### frontend/Containerfile

```dockerfile
# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### frontend/nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🐳 Step 4: Podman Compose Configuration

### compose.yaml

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: todo-postgres
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-tododb}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backend/src/db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  redis:
    image: redis:7-alpine
    container_name: todo-redis
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Containerfile
    container_name: todo-backend
    environment:
      PORT: 5000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: ${DB_USER:-postgres}
      DB_PASSWORD: ${DB_PASSWORD:-postgres}
      DB_NAME: ${DB_NAME:-tododb}
      REDIS_HOST: redis
    ports:
      - "5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - frontend
      - backend

  frontend:
    build:
      context: ./frontend
      dockerfile: Containerfile
    container_name: todo-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - frontend

volumes:
  postgres-data:
  redis-data:

networks:
  frontend:
  backend:
```

### .env

```env
DB_USER=postgres
DB_PASSWORD=supersecret
DB_NAME=tododb
```

### .containerignore

```
node_modules
npm-debug.log
.env
.git
.gitignore
README.md
.vscode
```

---

## 🚀 Step 5: Build and Run

```bash
# Build all images
podman-compose build

# Start all services
podman-compose up -d

# View logs
podman-compose logs -f

# Check status
podman-compose ps
```

### Access the Application

```
Frontend: http://localhost
Backend API: http://localhost:5000/api/todos
Health Check: http://localhost:5000/health
```

---

## 🧪 Step 6: Test the Application

```bash
# Check backend health
curl http://localhost:5000/health

# Get all todos
curl http://localhost:5000/api/todos

# Create todo
curl -X POST http://localhost:5000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Todo","description":"Testing API"}'

# Update todo
curl -X PUT http://localhost:5000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated","description":"Updated desc","completed":true}'

# Delete todo
curl -X DELETE http://localhost:5000/api/todos/1
```

---

## 🎯 Summary

### What You Built

✅ **Full-stack containerized application**  
✅ **Multi-tier architecture** (Frontend, Backend, Database, Cache)  
✅ **Production-ready Containerfiles** with multi-stage builds  
✅ **Podman Compose** orchestration  
✅ **Persistent data** with volumes  
✅ **Network isolation** with custom networks  
✅ **Health checks** for all services  
✅ **Optimized images** (~50MB frontend, ~200MB backend)  

### Key Learnings

1. ✅ Container orchestration with Podman Compose
2. ✅ Multi-stage builds for optimization
3. ✅ Service dependencies and health checks
4. ✅ Volume management for data persistence
5. ✅ Network segmentation (frontend/backend)
6. ✅ Environment variable management
7. ✅ Production-ready containerization

---

**Congratulations!** You've successfully built and deployed a complete containerized application with Podman! 🎉

**Next**: [Day 5 - Kubernetes Basics →](../Day-5/README.md)
