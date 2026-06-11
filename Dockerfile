FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates jq \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.3 --activate

WORKDIR /app

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT
ENV DATABASE_URL=file:/data/listings.db
ENV HUSKY=0

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts prisma.config.js prisma.config.d.ts tsconfig.json ./

RUN pnpm install --frozen-lockfile

COPY src ./src
COPY find-my-house/run.sh /run.sh

RUN pnpm run build && chmod +x /run.sh

ENV NODE_ENV=production

CMD ["/run.sh"]
