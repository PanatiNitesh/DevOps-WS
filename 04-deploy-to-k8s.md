# 🚀 Deploy to Kubernetes – Complete Project

## 📚 Table of Contents
- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Step 1: Build Application with Podman](#step-1-build-application-with-podman)
- [Step 2: Push Images to Registry](#step-2-push-images-to-registry)
- [Step 3: Create Kubernetes Manifests](#step-3-create-kubernetes-manifests)
- [Step 4: Deploy to Kubernetes](#step-4-deploy-to-kubernetes)
- [Step 5: Access and Test](#step-5-access-and-test)
- [Step 6: Scale and Update](#step-6-scale-and-update)
- [Bonus: Full-Stack Deployment](#bonus-full-stack-deployment)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

**Goal:** Deploy the **Todo Application** from Day 4 to Kubernetes using Podman-built images.

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  Frontend Service (LoadBalancer)               │    │
│  │  http://<external-ip>:3000                     │    │
│  └─────────────────┬──────────────────────────────┘    │
│                    │                                     │
│  ┌─────────────────▼──────────────────────────────┐    │
│  │  Frontend Deployment (React)                   │    │
│  │  Replicas: 3                                   │    │
│  │  Image: your-dockerhub/todo-frontend:v1       │    │
│  └─────────────────┬──────────────────────────────┘    │
│                    │ HTTP                                │
│  ┌─────────────────▼──────────────────────────────┐    │
│  │  Backend Service (ClusterIP)                   │    │
│  │  backend-service:5000                          │    │
│  └─────────────────┬──────────────────────────────┘    │
│                    │                                     │
│  ┌─────────────────▼──────────────────────────────┐    │
│  │  Backend Deployment (Node.js)                  │    │
│  │  Replicas: 3                                   │    │
│  │  Image: your-dockerhub/todo-backend:v1        │    │
│  └────┬─────────────────────────────────┬─────────┘    │
│       │                                  │              │
│  ┌────▼──────────────┐       ┌──────────▼────────┐    │
│  │ PostgreSQL        │       │ Redis              │    │
│  │ StatefulSet       │       │ Deployment         │    │
│  │ Persistent Volume │       │ Cache              │    │
│  └───────────────────┘       └────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**What You'll Learn:**
1. Build multi-arch images with Podman
2. Push to Docker Hub (or Quay.io)
3. Write production-ready Kubernetes YAML manifests
4. Deploy multi-tier application to Kubernetes
5. Expose services externally
6. Scale, update, and rollback deployments

---

## ✅ Prerequisites

Before starting, ensure you have:

- ✅ **Podman installed** (from Day 4)
- ✅ **kind cluster running** with Podman provider
- ✅ **kubectl configured**
- ✅ **Docker Hub account** (free: https://hub.docker.com)

**Verify:**
```bash
podman --version          # v4.9.0 or later
minikube status           # Running
kubectl cluster-info      # Kubernetes control plane URL
```

---

## 🔨 Step 1: Build Application with Podman

### Project Structure

We'll use a simplified Todo app:

```
todo-app/
├── backend/
│   ├── Containerfile
│   ├── server.js
│   ├── package.json
│   └── .dockerignore
├── frontend/
│   ├── Containerfile
│   ├── src/
│   ├── package.json
│   └── .dockerignore
└── k8s/
    ├── namespace.yaml
    ├── backend-deployment.yaml
    ├── backend-service.yaml
    ├── frontend-deployment.yaml
    ├── frontend-service.yaml
    ├── postgres.yaml
    ├── redis.yaml
    ├── configmap.yaml
    └── secret.yaml
```

### 1. Backend Application

**`backend/server.js`** (Simplified):
```javascript
const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-service',
  port: 5432,
  database: process.env.DB_NAME || 'todos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password'
});

// Redis connection
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis-service'}:6379`
});
redisClient.connect();

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Get all todos
app.get('/api/todos', async (req, res) => {
  try {
    // Try cache first
    const cached = await redisClient.get('todos');
    if (cached) {
      return res.json({ source: 'cache', data: JSON.parse(cached) });
    }

    // Query database
    const result = await pool.query('SELECT * FROM todos ORDER BY id DESC');
    await redisClient.setEx('todos', 60, JSON.stringify(result.rows));
    res.json({ source: 'database', data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create todo
app.post('/api/todos', async (req, res) => {
  const { title } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO todos (title, completed) VALUES ($1, false) RETURNING *',
      [title]
    );
    await redisClient.del('todos'); // Invalidate cache
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
```

**`backend/package.json`**:
```json
{
  "name": "todo-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "redis": "^4.6.10"
  }
}
```

**`backend/Containerfile`**:
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "start"]
```

**`backend/.dockerignore`**:
```
node_modules
npm-debug.log
.env
.git
```

### 2. Frontend Application

**`frontend/Containerfile`**:
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:1.25-alpine

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
```

**`frontend/nginx.conf`**:
```nginx
server {
    listen 3000;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # React Router support
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend-service:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Build Images with Podman

```bash
# Navigate to project directory
cd todo-app

# Build backend image
cd backend
podman build -t todo-backend:v1 -f Containerfile .

# Build frontend image
cd ../frontend
podman build -t todo-frontend:v1 -f Containerfile .

# Verify images
podman images | grep todo
# todo-backend   v1   abc123def456   2 minutes ago   180MB
# todo-frontend  v1   def456ghi789   1 minute ago    45MB
```

**Test locally:**
```bash
# Create network
podman network create todo-network

# Run PostgreSQL
podman run -d --name postgres --network todo-network \
  -e POSTGRES_DB=todos \
  -e POSTGRES_PASSWORD=password \
  postgres:15-alpine

# Run Redis
podman run -d --name redis --network todo-network \
  redis:7-alpine

# Initialize database
podman exec -it postgres psql -U postgres -d todos -c \
  "CREATE TABLE IF NOT EXISTS todos (id SERIAL PRIMARY KEY, title TEXT NOT NULL, completed BOOLEAN DEFAULT false);"

# Run backend
podman run -d --name backend --network todo-network \
  -p 5000:5000 \
  -e DB_HOST=postgres \
  -e REDIS_HOST=redis \
  -e DB_PASSWORD=password \
  todo-backend:v1

# Run frontend
podman run -d --name frontend --network todo-network \
  -p 3000:3000 \
  todo-frontend:v1

# Test
curl http://localhost:5000/health
# {"status":"healthy","timestamp":"2024-01-15T10:30:00.000Z"}

# Open browser: http://localhost:3000

# Cleanup
podman stop postgres redis backend frontend
podman rm postgres redis backend frontend
podman network rm todo-network
```

---

## 📤 Step 2: Push Images to Registry

### Option 1: Docker Hub

**1. Login:**
```bash
podman login docker.io
# Username: your-dockerhub-username
# Password: your-password-or-token
```

**2. Tag images:**
```bash
podman tag todo-backend:v1 docker.io/your-username/todo-backend:v1
podman tag todo-frontend:v1 docker.io/your-username/todo-frontend:v1
```

**3. Push images:**
```bash
podman push docker.io/your-username/todo-backend:v1
podman push docker.io/your-username/todo-frontend:v1
```

**4. Verify on Docker Hub:**
Visit https://hub.docker.com/r/your-username/todo-backend

### Option 2: Quay.io (Red Hat's Registry)

```bash
# Login
podman login quay.io
# Username: your-quay-username
# Password: your-password

# Tag
podman tag todo-backend:v1 quay.io/your-username/todo-backend:v1
podman tag todo-frontend:v1 quay.io/your-username/todo-frontend:v1

# Push
podman push quay.io/your-username/todo-backend:v1
podman push quay.io/your-username/todo-frontend:v1
```

### Public vs Private Images

**Public:** Anyone can pull (good for demos)
**Private:** Requires authentication

**For private images, create imagePullSecret:**
```bash
kubectl create secret docker-registry regcred \
  --docker-server=docker.io \
  --docker-username=your-username \
  --docker-password=your-password \
  --docker-email=your-email@example.com
```

---

## 📝 Step 3: Create Kubernetes Manifests

Create `k8s/` directory:

### 1. Namespace

**`k8s/namespace.yaml`**:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: todo-app
  labels:
    name: todo-app
    environment: production
```

### 2. ConfigMap

**`k8s/configmap.yaml`**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: todo-app
data:
  DB_HOST: "postgres-service"
  DB_NAME: "todos"
  DB_USER: "postgres"
  REDIS_HOST: "redis-service"
  NODE_ENV: "production"
  LOG_LEVEL: "info"
```

### 3. Secret

**`k8s/secret.yaml`**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secret
  namespace: todo-app
type: Opaque
data:
  # Base64 encoded values
  # echo -n 'password' | base64  → cGFzc3dvcmQ=
  DB_PASSWORD: cGFzc3dvcmQ=
  # echo -n 'redis-secret-key' | base64
  REDIS_PASSWORD: cmVkaXMtc2VjcmV0LWtleQ==
```

### 4. PostgreSQL

**`k8s/postgres.yaml`**:
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: todo-app
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: todo-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_NAME
        - name: POSTGRES_USER
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secret
              key: DB_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: todo-app
spec:
  type: ClusterIP
  selector:
    app: postgres
  ports:
  - protocol: TCP
    port: 5432
    targetPort: 5432
```

### 5. Redis

**`k8s/redis.yaml`**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: todo-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: todo-app
spec:
  type: ClusterIP
  selector:
    app: redis
  ports:
  - protocol: TCP
    port: 6379
    targetPort: 6379
```

### 6. Backend

**`k8s/backend-deployment.yaml`**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: todo-app
  labels:
    app: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-username/todo-backend:v1  # ← CHANGE THIS
        ports:
        - containerPort: 5000
        envFrom:
        - configMapRef:
            name: app-config
        env:
        - name: PORT
          value: "5000"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secret
              key: DB_PASSWORD
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**`k8s/backend-service.yaml`**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: todo-app
spec:
  type: ClusterIP
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 5000
    targetPort: 5000
```

### 7. Frontend

**`k8s/frontend-deployment.yaml`**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: todo-app
  labels:
    app: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: your-username/todo-frontend:v1  # ← CHANGE THIS
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
```

**`k8s/frontend-service.yaml`**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: todo-app
spec:
  type: LoadBalancer  # Will stay <pending> in kind, use port-forward
  selector:
    app: frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
```

---

## 🚀 Step 4: Deploy to Kubernetes

### 1. Ensure kind Cluster is Running

```bash
kubectl cluster-info
kubectl get nodes
```

### 2. Apply Manifests in Order

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create ConfigMap and Secret
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# Deploy databases
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n todo-app --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n todo-app --timeout=120s

# Initialize database schema
kubectl exec -it -n todo-app $(kubectl get pod -n todo-app -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- \
  psql -U postgres -d todos -c \
  "CREATE TABLE IF NOT EXISTS todos (id SERIAL PRIMARY KEY, title TEXT NOT NULL, completed BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW());"

# Deploy backend
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# Wait for backend
kubectl wait --for=condition=ready pod -l app=backend -n todo-app --timeout=120s

# Deploy frontend
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

# Wait for frontend
kubectl wait --for=condition=ready pod -l app=frontend -n todo-app --timeout=120s
```

### 3. Verify Deployment

```bash
# Check all resources
kubectl get all -n todo-app

# Expected output:
# NAME                            READY   STATUS    RESTARTS   AGE
# pod/backend-xyz123              1/1     Running   0          2m
# pod/backend-abc456              1/1     Running   0          2m
# pod/backend-def789              1/1     Running   0          2m
# pod/frontend-ghi012             1/1     Running   0          1m
# pod/frontend-jkl345             1/1     Running   0          1m
# pod/postgres-mno678             1/1     Running   0          5m
# pod/redis-pqr901                1/1     Running   0          5m
#
# NAME                       TYPE           CLUSTER-IP      EXTERNAL-IP   PORT(S)
# service/backend-service    ClusterIP      10.96.123.45    <none>        5000/TCP
# service/frontend-service   LoadBalancer   10.96.45.67     <pending>     80:30123/TCP
# service/postgres-service   ClusterIP      10.96.78.90     <none>        5432/TCP
# service/redis-service      ClusterIP      10.96.12.34     <none>        6379/TCP
#
# NAME                       READY   UP-TO-DATE   AVAILABLE   AGE
# deployment.apps/backend    3/3     3            3           2m
# deployment.apps/frontend   2/2     2            2           1m
# deployment.apps/postgres   1/1     1            1           5m
# deployment.apps/redis      1/1     1            1           5m
```

---

## 🌐 Step 5: Access and Test

### Option 1: LoadBalancer with Minikube Tunnel

**Terminal 1:**
```bash
minikube tunnel
# Status:
#         machine: minikube
#         pid: 12345
#         route: 10.96.0.0/12 -> 192.168.49.2
#         minikube: Running
#         services: [frontend-service]
```

**Terminal 2:**
```bash
# Get external IP
kubectl get service frontend-service -n todo-app
# NAME               TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)
# frontend-service   LoadBalancer   10.96.45.67    127.0.0.1     80:30123/TCP

# Access app
open http://127.0.0.1  # macOS
# Or
curl http://127.0.0.1
```

### Option 2: NodePort

**Change frontend service to NodePort:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: todo-app
spec:
  type: NodePort
  selector:
    app: frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
    nodePort: 30080  # Optional: specify port
```

```bash
kubectl apply -f k8s/frontend-service.yaml

# Use port-forward to access NodePort
kubectl port-forward service/frontend-service 3000:80 -n todo-app

# Access application at:
# http://localhost:3000
```

### Option 3: Port Forwarding (Development)

```bash
kubectl port-forward -n todo-app service/frontend-service 8080:80
# Forwarding from 127.0.0.1:8080 -> 3000

# Access app
open http://localhost:8080
```

### Test Backend API

```bash
# Port forward backend
kubectl port-forward -n todo-app service/backend-service 5000:5000

# Health check
curl http://localhost:5000/health
# {"status":"healthy","timestamp":"2024-01-15T10:30:00.000Z"}

# Get todos
curl http://localhost:5000/api/todos
# {"source":"database","data":[]}

# Create todo
curl -X POST http://localhost:5000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn Kubernetes"}'
# {"id":1,"title":"Learn Kubernetes","completed":false}

# Get todos again (should be cached)
curl http://localhost:5000/api/todos
# {"source":"cache","data":[{"id":1,"title":"Learn Kubernetes","completed":false}]}
```

---

## 📊 Step 6: Scale and Update

### 1. Scale Backend

```bash
# Scale to 5 replicas
kubectl scale deployment backend -n todo-app --replicas=5

# Watch scaling
kubectl get pods -n todo-app -l app=backend --watch

# Verify
kubectl get deployment backend -n todo-app
# NAME      READY   UP-TO-DATE   AVAILABLE   AGE
# backend   5/5     5            5           10m
```

### 2. Update Application (Rolling Update)

**Update backend to v2:**

```bash
# Build new version
cd backend
# Make code changes...
podman build -t todo-backend:v2 -f Containerfile .
podman tag todo-backend:v2 your-username/todo-backend:v2
podman push your-username/todo-backend:v2

# Update deployment
kubectl set image deployment/backend -n todo-app \
  backend=your-username/todo-backend:v2

# Watch rollout
kubectl rollout status deployment/backend -n todo-app
# Waiting for deployment "backend" rollout to finish: 2 out of 5 new replicas have been updated...
# deployment "backend" successfully rolled out

# Check rollout history
kubectl rollout history deployment/backend -n todo-app
# REVISION  CHANGE-CAUSE
# 1         <none>
# 2         <none>
```

### 3. Rollback if Needed

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n todo-app

# Check status
kubectl rollout status deployment/backend -n todo-app

# Rollback to specific revision
kubectl rollout undo deployment/backend -n todo-app --to-revision=1
```

### 4. Autoscaling

**Create Horizontal Pod Autoscaler:**
```bash
kubectl autoscale deployment backend -n todo-app \
  --cpu-percent=70 \
  --min=3 \
  --max=10

# View HPA
kubectl get hpa -n todo-app
# NAME      REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
# backend   Deployment/backend   15%/70%   3         10        3          1m
```

**Or via YAML:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: todo-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 5. View Logs

```bash
# Single pod logs
kubectl logs -n todo-app <pod-name>

# Follow logs
kubectl logs -f -n todo-app <pod-name>

# All backend pods
kubectl logs -n todo-app -l app=backend --tail=50

# Stream logs from all pods
kubectl logs -f -n todo-app -l app=backend
```

---

## 🎁 Bonus: Full-Stack Deployment Script

**`deploy.sh`**:
```bash
#!/bin/bash

set -e  # Exit on error

echo "🚀 Deploying Todo App to Kubernetes..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
NAMESPACE="todo-app"
DOCKER_USERNAME="your-username"  # CHANGE THIS

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }
command -v podman >/dev/null 2>&1 || { echo "podman not found"; exit 1; }
kubectl get nodes >/dev/null 2>&1 || { echo "kind cluster not running"; exit 1; }

# Build images
echo -e "${BLUE}Building images...${NC}"
cd backend
podman build -t todo-backend:v1 -f Containerfile .
cd ../frontend
podman build -t todo-frontend:v1 -f Containerfile .
cd ..

# Tag images
echo -e "${BLUE}Tagging images...${NC}"
podman tag todo-backend:v1 ${DOCKER_USERNAME}/todo-backend:v1
podman tag todo-frontend:v1 ${DOCKER_USERNAME}/todo-frontend:v1

# Push images
echo -e "${BLUE}Pushing images to registry...${NC}"
podman push ${DOCKER_USERNAME}/todo-backend:v1
podman push ${DOCKER_USERNAME}/todo-frontend:v1

# Deploy to Kubernetes
echo -e "${BLUE}Deploying to Kubernetes...${NC}"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml

echo "Waiting for databases..."
kubectl wait --for=condition=ready pod -l app=postgres -n ${NAMESPACE} --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n ${NAMESPACE} --timeout=120s

# Initialize database
echo -e "${BLUE}Initializing database...${NC}"
POSTGRES_POD=$(kubectl get pod -n ${NAMESPACE} -l app=postgres -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it -n ${NAMESPACE} ${POSTGRES_POD} -- psql -U postgres -d todos -c \
  "CREATE TABLE IF NOT EXISTS todos (id SERIAL PRIMARY KEY, title TEXT NOT NULL, completed BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW());"

kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

echo "Waiting for application..."
kubectl wait --for=condition=ready pod -l app=backend -n ${NAMESPACE} --timeout=120s
kubectl wait --for=condition=ready pod -l app=frontend -n ${NAMESPACE} --timeout=120s

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Access your app:"
echo "  kubectl port-forward service/frontend-service 3000:3000 -n ${NAMESPACE}"
echo ""
echo "View resources:"
echo "  kubectl get all -n ${NAMESPACE}"
```

**Make executable and run:**
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 🐛 Troubleshooting

### 1. Pods Not Starting

**Check pod status:**
```bash
kubectl get pods -n todo-app
```

**Common issues:**

**ImagePullBackOff:**
```bash
kubectl describe pod <pod-name> -n todo-app
# Events: Failed to pull image "your-username/todo-backend:v1": not found

# Fix: Verify image exists
podman search docker.io/your-username/todo-backend

# Or check image name in deployment YAML
```

**CrashLoopBackOff:**
```bash
kubectl logs <pod-name> -n todo-app
# Check for application errors

kubectl logs <pod-name> -n todo-app --previous
# View logs from crashed container
```

### 2. Service Not Accessible

```bash
# Check service
kubectl get svc -n todo-app

# Check endpoints (should list pod IPs)
kubectl get endpoints backend-service -n todo-app

# If no endpoints, check pod labels match service selector
kubectl get pods -n todo-app --show-labels
kubectl describe service backend-service -n todo-app
```

### 3. Database Connection Issues

```bash
# Check if PostgreSQL is running
kubectl get pods -n todo-app -l app=postgres

# Test connection from backend pod
kubectl exec -it -n todo-app <backend-pod> -- sh
# Inside pod:
nc -zv postgres-service 5432
# Connection to postgres-service 5432 port [tcp/postgresql] succeeded!
```

### 4. ConfigMap/Secret Not Loading

```bash
# Verify ConfigMap
kubectl get configmap app-config -n todo-app -o yaml

# Verify Secret
kubectl get secret app-secret -n todo-app -o yaml

# Check environment variables in pod
kubectl exec -it -n todo-app <backend-pod> -- env | grep DB_
```

### 5. View Events

```bash
# All events in namespace
kubectl get events -n todo-app --sort-by='.lastTimestamp'

# Watch events
kubectl get events -n todo-app --watch
```

---

## 🧹 Cleanup

**Delete entire app:**
```bash
kubectl delete namespace todo-app
```

**Or delete resources individually:**
```bash
kubectl delete -f k8s/frontend-service.yaml
kubectl delete -f k8s/frontend-deployment.yaml
kubectl delete -f k8s/backend-service.yaml
kubectl delete -f k8s/backend-deployment.yaml
kubectl delete -f k8s/redis.yaml
kubectl delete -f k8s/postgres.yaml
kubectl delete -f k8s/secret.yaml
kubectl delete -f k8s/configmap.yaml
kubectl delete -f k8s/namespace.yaml
```

**Stop kind cluster:**
```bash
kind delete cluster --name kubectl-cluster
```

---

## 🎓 Summary

**You've successfully:**
✅ Built multi-container application with Podman  
✅ Pushed images to Docker Hub/Quay  
✅ Created production-ready Kubernetes manifests  
✅ Deployed multi-tier app to Kubernetes  
✅ Exposed services externally  
✅ Scaled deployments  
✅ Performed rolling updates and rollbacks  
✅ Troubleshooted common issues  

**Key Concepts:**
- **Podman → Kubernetes workflow** (build locally, deploy remotely)
- **ConfigMaps & Secrets** for configuration management
- **Services** for stable networking
- **Deployments** for declarative updates
- **PersistentVolumes** for stateful data
- **Health checks** for reliability

---

## 🚀 Next Steps

1. **Add monitoring:** Prometheus + Grafana
2. **Implement ingress:** Nginx Ingress Controller
3. **Set up CI/CD:** GitHub Actions → Kubernetes
4. **Add logging:** ELK Stack or Loki
5. **Learn Helm:** Package manager for Kubernetes
6. **Explore GitOps:** ArgoCD or Flux

---

**Congratulations!** 🎉 You've completed the 5-day DevOps workshop!

**You now know:**
- DevOps principles and culture
- Git workflows and GitHub Actions
- CI/CD pipelines
- Containerization with Podman
- Container orchestration with Kubernetes

**Keep learning and building! 🚀**
