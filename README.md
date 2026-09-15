# NBA Live Event Platform

This project processes NBA play-by-play events with independently scalable backend workers. The goal is to explore event-driven systems, failure recovery, and running the same stack locally with Docker and Kubernetes.

## Getting started

- Node.js 22.13 or newer
- pnpm 11

```bash
pnpm install
pnpm check
```

The `check` command runs formatting checks, linting, type checks, tests, and builds.

## Run with Docker

With Docker Desktop running:

```bash
docker compose up --build
```

The API is available at `http://localhost:3000`. The replay service loads the
sample game once and then exits; the API and workers keep running.

Stop the stack with:

```bash
docker compose down
```

## Project structure

```text
apps/
  ingestion-api/ Fastify API for accepting events
  replay-service/ Sends fixture events through the ingestion API
packages/
  database/  PostgreSQL connection and persistence code
  event-bus/ Broker-neutral event delivery contracts
  schemas/   Shared event schemas and TypeScript types
workers/
  analytics/  Builds game-level analytics from events
  box-score/  Builds player box scores from events
  game-state/ Builds live game state from events
```
