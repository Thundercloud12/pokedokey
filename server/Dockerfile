# Stage 1: Build TypeScript source
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and workspace package manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/

# Install all workspace dependencies
RUN npm ci

# Copy TypeScript configs and source code
COPY shared/ ./shared/
COPY server/ ./server/

# Build shared library then server
RUN npm --workspace=@game/shared run build
RUN npm --workspace=@game/server run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=2567

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/

RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript outputs
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist

USER node

EXPOSE 2567

CMD ["node", "server/dist/index.js"]
