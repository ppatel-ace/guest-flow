FROM node:22 AS builder

WORKDIR /app

COPY package.json package-lock.json .npmrc ./

# Replit rewrites lockfile tarball URLs to an internal host that does not resolve in Docker.
RUN sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g; s|https://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json \
    && npm install -g npm@11 \
    && npm ci --ignore-scripts

COPY . .

RUN npm run build

# Prune dev/optional deps in-place — no install scripts run, just directory removal
RUN npm prune --omit=dev --omit=optional --ignore-scripts

FROM node:22-alpine AS runner

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
