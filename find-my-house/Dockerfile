FROM node:20-bookworm-slim

ARG BUILD_ARCH
ARG BUILD_VERSION
ARG GIT_REPOSITORY=https://github.com/Achaak/find-my-home.git
ARG GIT_BRANCH=main

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates jq git \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.3 --activate

WORKDIR /app

RUN git clone --depth 1 --branch "${GIT_BRANCH}" "${GIT_REPOSITORY}" /tmp/repo \
  && cp -a /tmp/repo/. /app/ \
  && rm -rf /tmp/repo

ENV DATABASE_URL=file:/data/listings.db
ENV HUSKY=0

RUN pnpm install --frozen-lockfile \
  && pnpm run build \
  && cp find-my-house/run.sh /run.sh \
  && chmod +x /run.sh

ENV NODE_ENV=production

CMD ["/run.sh"]
