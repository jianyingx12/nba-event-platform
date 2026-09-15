FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nba-event-platform/analytics-worker... build

ENV NODE_ENV=production

CMD ["node", "workers/analytics/dist/main.js"]
