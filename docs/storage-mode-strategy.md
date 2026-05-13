# Storage Mode Strategy

The global storage mode strategy defines how the platform selects storage for tests, local development, and production.

## Modes

Supported modes:

    auto
    memory
    sqlite
    postgres

## Intended usage

    memory   -> tests and ephemeral local runs
    sqlite   -> local/dev zero-config usage
    postgres -> production and live pilots
    auto     -> local-friendly default with production-aware validation

## Local default

Outside production, `auto` selects sqlite:

    .data/deterministic-agent-system.sqlite

This preserves local zero-config usage.

## Production default

In production, `auto` requires Postgres.

If `NODE_ENV=production` and no `DATABASE_URL` is configured, resolution fails with:

    PRODUCTION_POSTGRES_REQUIRED

This makes the production recommendation explicit instead of silently falling back to local storage.

## Explicit Postgres

When mode is explicitly set to:

    postgres

a connection URL is required.

If missing, resolution fails with:

    POSTGRES_DATABASE_URL_REQUIRED

## Implementation

    src/storage/storage-mode.ts

## Tests

    tests/storage/storage-mode.test.ts

## Verification

    npm run build
    npm run test:baseline:contractual