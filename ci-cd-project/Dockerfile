
# Stage 1: Build
FROM node:18-alpine AS builder
# For Python: FROM python:3.11-slim AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
# For Python: COPY requirements.txt ./

# Install dependencies
RUN npm install --production --only=production
# For Python: RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Stage 2: Production
FROM node:18-alpine
# For Python: FROM python:3.11-slim

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/app.js"]