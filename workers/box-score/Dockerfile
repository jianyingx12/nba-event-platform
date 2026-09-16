FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nba-event-platform/box-score-worker... build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "workers/box-score/dist/main.js"]
