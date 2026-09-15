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

## Project structure

```text
apps/
  ingestion-api/ Fastify API for accepting events
packages/
  database/  PostgreSQL connection and persistence code
  event-bus/ Broker-neutral event delivery contracts
  schemas/   Shared event schemas and TypeScript types
workers/
  box-score/  Builds player box scores from events
  game-state/ Builds live game state from events
```
