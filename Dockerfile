FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json .npmrc ./

# Replit rewrites lockfile tarball URLs to an internal host that does not resolve in Docker.
RUN sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g; s|https://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json \
    && npm install -g npm@11 \
    && npm install --no-audit --no-fund

COPY . .

RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Fonts for SVG badge text rendering (DejaVu Sans)
RUN apt-get update \
    && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./

# Fresh production install so sharp gets the correct linux-x64 native binding (not musl/alpine).
RUN sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g; s|https://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json \
    && npm install --omit=dev --include=optional --no-audit --no-fund

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/server/assets ./server/assets

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
