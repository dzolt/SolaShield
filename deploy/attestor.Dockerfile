# Attestor and Steam simulator (attestor/server.ts). The signing key is mounted at run time, never baked into the image.
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

ENV NODE_ENV=production
COPY attestor ./attestor
COPY scripts ./scripts
COPY market ./market
RUN mkdir -p keys attestor/data && chown -R node:node attestor/data

USER node
EXPOSE 8787
CMD ["node_modules/.bin/tsx", "attestor/server.ts"]
