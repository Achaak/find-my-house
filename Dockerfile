FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates jq psmisc \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.3 --activate

WORKDIR /app

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT
ENV DATABASE_URL=file:/data/listings.db
ENV HUSKY=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/api-types/package.json packages/api-types/tsconfig.json ./packages/api-types/
COPY packages/api-types/src ./packages/api-types/src
COPY web/package.json ./web/
COPY prisma ./prisma
COPY prisma.config.ts prisma.config.js prisma.config.d.ts tsconfig.json ./

RUN pnpm install --frozen-lockfile

ENV CLOAKBROWSER_CACHE_DIR=/opt/cloakbrowser
ENV CLOAKBROWSER_AUTO_UPDATE=false
RUN mkdir -p /opt/cloakbrowser && pnpm exec cloakbrowser install

COPY src ./src
COPY packages/api-types ./packages/api-types
COPY web ./web
COPY home-assistant/run.sh /run.sh

RUN pnpm run build:all && chmod +x /run.sh

ENV NODE_ENV=production

CMD ["/run.sh"]
