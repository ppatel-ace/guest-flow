FROM node:22 AS builder

WORKDIR /app

COPY package.json package-lock.json .npmrc ./

# External Docker hosts cannot resolve either Replit package-firewall hostname.
# Normalize only the image's copy; keep versions and integrity hashes unchanged.
RUN sed -E -i 's#https?://package-firewall\.replit\.(local|internal)/npm/#https://registry.npmjs.org/#g' package-lock.json \
    && npm install -g npm@11 \
    && npm ci --ignore-scripts

COPY . .

# COPY restores the workspace lockfile, so normalize again before build/prune.
RUN sed -E -i 's#https?://package-firewall\.replit\.(local|internal)/npm/#https://registry.npmjs.org/#g' package-lock.json \
    && npm run build

# Prune dev/optional deps in-place — no install scripts run, just directory removal
RUN npm prune --omit=dev --omit=optional

FROM node:22-alpine AS runner

WORKDIR /app

# Copy the already-pruned node_modules — no second npm install needed
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/server/data ./server/data
COPY package.json ./

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
