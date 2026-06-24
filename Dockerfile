FROM node:20 AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# Prune dev/optional deps in-place — no install scripts run, just directory removal
RUN npm prune --omit=dev --omit=optional

FROM node:20-alpine AS runner

WORKDIR /app

# Copy the already-pruned node_modules — no second npm install needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
