# Order Processing System

A production-quality **Order Processing System** built with **Node.js, TypeScript, Express, Prisma ORM and PostgreSQL**, following **Clean Architecture** and SOLID principles.

The emphasis is not merely on "working APIs" but on **maintainability, testability, and clear separation of concerns** — the qualities that make a codebase pleasant to extend and safe to operate in production.

---

## Table of Contents

- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [Business Rules](#business-rules)
- [API Documentation](#api-documentation)
- [How to Run](#how-to-run)
- [Testing](#testing)
- [Scheduler](#scheduler)
- [Configuration](#configuration)
- [Design Decisions](#design-decisions)
- [Scaling & Future Improvements](#scaling--future-improvements)
- [AI Usage](#ai-usage)

---

## Architecture

The system uses a **layered (Clean) Architecture**. Dependencies point **inward**, and each layer has a single, well-defined responsibility:

```
        HTTP Request
             │
             ▼
   ┌───────────────────┐   Thin. Translates HTTP <-> domain. No business logic.
   │    Controller     │
   └───────────────────┘
             │
             ▼
   ┌───────────────────┐   All business rules: totals, state machine, cancellation.
   │      Service      │   Depends on the repository *interface*, not Prisma.
   └───────────────────┘
             │
             ▼
   ┌───────────────────┐   Only persistence concerns. Talks to Prisma.
   │    Repository     │   Implements IOrderRepository.
   └───────────────────┘
             │
             ▼
   ┌───────────────────┐
   │      Prisma       │
   └───────────────────┘
             │
             ▼
   ┌───────────────────┐
   │    PostgreSQL     │
   └───────────────────┘
```

**Key principles**

- **Controllers never contain business logic** — they validate (via middleware), call a service, and shape the HTTP response.
- **Services own all business rules** — total calculation, status-transition state machine, and cancellation policy.
- **Repositories only touch Prisma** — swapping the database means changing one layer.
- **Dependency Injection** — a small composition root (`src/config/container.ts`) wires the layers. The service depends on the `IOrderRepository` **interface**, which makes it trivially unit-testable with an in-memory fake.
- **`async/await` everywhere**, **strict TypeScript**, and a **centralized error handler** that never leaks stack traces.

---

## Project Structure

```
src/
├── controllers/      # HTTP adapters (thin)
├── services/         # Business logic
├── repositories/     # Prisma data access (+ IOrderRepository interface)
├── routes/           # Express routers + OpenAPI annotations
├── middleware/       # validate, error handler, request logging
├── scheduler/        # node-cron background job
├── config/           # env, logger, prisma client, swagger, DI container
├── validations/      # Zod schemas
├── utils/            # errors, presenter, status state machine, asyncHandler
├── types/            # shared domain types
├── app.ts            # Express app assembly
└── server.ts         # bootstrap + graceful shutdown
prisma/
├── schema.prisma     # data model
└── seed.ts           # local seed data
tests/
├── unit/             # service + scheduler unit tests
├── integration/      # supertest API tests
└── helpers/          # in-memory repository + test container
```

---

## Database Design

Two tables with a one-to-many relationship (`Order` → `OrderItem`), plus a status enum.

**Order**

| Column         | Type            | Notes                          |
| -------------- | --------------- | ------------------------------ |
| `id`           | UUID (PK)       | generated                      |
| `customerName` | text            |                                |
| `status`       | `OrderStatus`   | default `PENDING`, indexed     |
| `totalAmount`  | Decimal(12,2)   | computed server-side           |
| `createdAt`    | timestamp       | default now, indexed           |
| `updatedAt`    | timestamp       | auto-updated                   |

**OrderItem**

| Column        | Type          | Notes                                  |
| ------------- | ------------- | -------------------------------------- |
| `id`          | UUID (PK)     | generated                              |
| `orderId`     | UUID (FK)     | → `Order.id`, `ON DELETE CASCADE`      |
| `productName` | text          |                                        |
| `quantity`    | integer       | > 0                                    |
| `price`       | Decimal(12,2) | > 0                                    |

**OrderStatus enum:** `PENDING → PROCESSING → SHIPPED → DELIVERED`, plus `CANCELLED`.

`Decimal` is used for monetary values to avoid floating-point rounding errors.

---

## Business Rules

- **Create order** — accepts multiple items; **total is computed on the server** (never trusted from the client); rejects non-positive quantities and prices.
- **Retrieve order** — returns the order with all its items, or `404`.
- **Update status** — enforces the state machine. Only `PENDING→PROCESSING`, `PROCESSING→SHIPPED`, `SHIPPED→DELIVERED` are allowed. Invalid transitions return `422`; no-op transitions return `409`.
- **Cancel order** — permitted **only** while `PENDING`; otherwise `409 Conflict`.
- **List orders** — supports `status` filter, pagination (`page`, `limit`), and sorting by `createdAt` (`sortOrder`).

---

## API Documentation

Interactive Swagger UI is served at **`/api-docs`** (raw spec at `/api-docs.json`).

Base path: **`/api/v1`**

| Method  | Endpoint                     | Description                         | Success | Notable errors           |
| ------- | ---------------------------- | ----------------------------------- | ------- | ------------------------ |
| `GET`   | `/health`                    | Health check                        | 200     | —                        |
| `POST`  | `/orders`                    | Create an order                     | 201     | 400 (validation)         |
| `GET`   | `/orders`                    | List orders (filter/paginate/sort)  | 200     | 400                      |
| `GET`   | `/orders/:id`                | Get an order by id                  | 200     | 404, 400 (bad UUID)      |
| `PATCH` | `/orders/:id/status`         | Update status (state machine)       | 200     | 409, 422, 400            |
| `POST`  | `/orders/:id/cancel`         | Cancel an order                     | 200     | 409                      |

**Example — create an order**

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "customerName": "Jane Doe",
    "items": [
      { "productName": "Wireless Mouse", "quantity": 2, "price": 19.99 },
      { "productName": "Keyboard", "quantity": 1, "price": 49.99 }
    ]
  }'
```

**Error response shape** (consistent across the API):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [ ... ] } }
```

---

## How to Run

### Option A — Docker (recommended)

Spins up PostgreSQL + the API, runs migrations automatically:

```bash
docker compose up --build
```

API: http://localhost:3000 · Docs: http://localhost:3000/api-docs

### Option B — Local

**Prerequisites:** Node.js 20+, a running PostgreSQL instance.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env      # then set DATABASE_URL

# 3. Generate the Prisma client and apply migrations
npm run prisma:generate
npm run prisma:migrate

# 4. (optional) seed sample data
npm run db:seed

# 5. Start in dev mode (auto-reload)
npm run dev

# ...or build & run for production
npm run build
npm start
```

---

## Testing

Testing uses **Jest + Supertest**.

```bash
npm test                 # all tests
npm run test:unit        # service + scheduler unit tests
npm run test:integration # HTTP API tests
```

- **Unit tests** verify business rules (total calculation, the status state machine, cancellation policy, pagination) against an **in-memory fake repository** — fast and hermetic.
- **Integration tests** drive the fully-wired Express app through real HTTP requests (routing → validation → controller → service → repository → presenter → error middleware), covering happy paths and edge cases (400/404/409/422).
- **Scheduler tests** verify the PENDING→PROCESSING promotion and the re-entry guard.

The in-memory repository is possible precisely because the service depends on the `IOrderRepository` interface — the same seam that would let you point integration tests at a real PostgreSQL test database.

---

## Scheduler

A background job (**node-cron**) runs **every 5 minutes** and promotes all `PENDING` orders to `PROCESSING`.

- The cron expression is configurable via `SCHEDULER_CRON` (default `*/5 * * * *`) and can be disabled with `SCHEDULER_ENABLED=false`.
- A **re-entry guard** prevents overlapping runs.
- Each execution is logged (count of orders promoted + duration).
- The promotion is a single bulk `updateMany` scoped to `status = PENDING`, so only the intended orders are touched.

---

## Configuration

Environment variables (validated at startup with Zod — the process fails fast on misconfiguration):

| Variable            | Default            | Description                            |
| ------------------- | ------------------ | -------------------------------------- |
| `NODE_ENV`          | `development`      | `development` \| `test` \| `production`|
| `PORT`              | `3000`             | HTTP port                              |
| `LOG_LEVEL`         | `info`             | Pino log level                         |
| `DATABASE_URL`      | —                  | PostgreSQL connection string (required)|
| `SCHEDULER_CRON`    | `*/5 * * * *`      | Cron expression for the promotion job  |
| `SCHEDULER_ENABLED` | `true`             | Toggle the scheduler                   |

---

## Design Decisions

- **Why Prisma?** Type-safe queries, auto-generated types, first-class migrations — fewer runtime errors, high productivity, and raw SQL still available when needed.
- **Why PostgreSQL?** ACID guarantees and relational integrity (FKs, transactions) fit orders-with-items naturally.
- **Why the Repository Pattern?** Decouples business logic from persistence; the DB can be swapped by changing one layer, and services are unit-testable via mocks/fakes.
- **Why a Service layer?** Centralizes business rules so they are reusable, testable, and not duplicated in controllers.
- **Why Zod?** Runtime validation with static type inference — one source of truth for shape and validation, with clear error messages before data reaches the domain.
- **Why node-cron?** Lightweight and sufficient for a single-instance periodic job. For distributed deployments I would move to BullMQ or Kubernetes CronJobs (see below).
- **Why Express (not NestJS)?** The assignment scope is small; Express keeps the architecture explicit and dependency-light. NestJS would add opinionated DI/modules that are valuable at larger scale.
- **Structured logging (Pino)** and a **centralized error middleware** keep observability and error contracts consistent; stack traces are logged, never returned to clients.

---

## Scaling & Future Improvements

**Scaling**

- Stateless API behind a load balancer; run multiple instances horizontally.
- Move the scheduler out of the app instances (BullMQ / K8s CronJob) so it runs exactly once.
- Add Redis caching for hot reads, and PostgreSQL read replicas for read-heavy traffic.
- Introduce a message queue (Kafka/RabbitMQ) for event-driven order processing.

**Improvements**

- AuthN/AuthZ (JWT/OAuth2) and role-based access control.
- Optimistic locking (a `version` column) to handle concurrent status updates safely.
- Idempotency keys on `POST /orders` to make retries safe.
- Audit logging and the outbox pattern for reliable event publishing.
- Distributed tracing (OpenTelemetry) and metrics (Prometheus/Grafana).
- API versioning strategy (already namespaced under `/api/v1`) and a CI/CD pipeline.

---

## AI Usage

AI tools were used as an **accelerator**, with every output reviewed, tested, and refined manually.

**ChatGPT / Claude** — validating the architecture, discussing design trade-offs (Prisma vs TypeORM, Express vs NestJS), refining API contracts, brainstorming edge-case tests, and reviewing the README.

**Cursor** — boilerplate generation, code completion, Prisma schema scaffolding, and test skeletons.

**Mistakes the AI made (and how they were caught):**

- Suggested **invalid order state transitions** (e.g. PENDING→DELIVERED) — corrected with an explicit transition map.
- Initially **missed transactional integrity** when creating an order with items — resolved using Prisma nested writes (single transaction).
- Generated **repetitive validation code** — refactored into a single generic `validate` middleware + Zod schemas.
- Proposed **generic error strings** — replaced with a structured `AppError` hierarchy and a consistent error envelope.
- Drafted a scheduler that **did not filter to only PENDING orders** — fixed with a status-scoped bulk update.

**Validation approach:** reviewed all generated code, enforced strict TypeScript + ESLint, verified business rules against the assignment, wrote unit/integration tests, and manually exercised the endpoints.

---

## License

MIT
