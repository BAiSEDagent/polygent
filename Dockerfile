FROM node:22-slim AS base
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --production=false

# Build backend
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Production image
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=base /app/dist ./dist
COPY --from=base /app/frontend/dist ./frontend/dist

EXPOSE 3000
ENV PORT=3000 BIND_ALL=true
CMD ["node", "dist/index.js"]
