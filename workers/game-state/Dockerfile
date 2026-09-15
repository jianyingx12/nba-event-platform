FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nba-event-platform/game-state-worker... build

ENV NODE_ENV=production

CMD ["node", "workers/game-state/dist/main.js"]
