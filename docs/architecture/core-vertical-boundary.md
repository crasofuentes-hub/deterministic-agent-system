# Core and Vertical Boundary

This project is a deterministic agent framework with optional domain verticals.

The core framework must remain domain-agnostic. Domain-specific business logic must live outside the core boundary.

## Core boundary

Core paths:

- src/core
- src/agent
- src/agent-run
- src/tools
- src/session-state
- src/session-store
- src/storage
- contracts

These paths must not depend on insurance, brokerage, carrier, coverage, premium, underwriting, or other business-domain specifics.

## Vertical boundary

Domain-specific logic belongs in vertical-specific areas such as:

- src/insurance
- config/business-context
- data
- tests/insurance
- channel or customer-service tests that explicitly prove vertical integration

The current insurance brokerage slice is a vertical implementation. It may model policy coverage, payment audit records, account-manager alerts, and WhatsApp/API parity as long as the framework core remains clean.

## Allowed dependency direction

Allowed:

- vertical -> core
- customer-service integration -> vertical facade
- channel/API parity tests -> customer-service integration

Not allowed:

- core -> insurance
- agent-run -> insurance
- tools core -> insurance
- session-state/session-store -> insurance
- storage core -> insurance
- contracts core -> insurance

## Architecture guard

The boundary is enforced by:

- tests/architecture/core-domain-boundary.test.ts

The guard scans core paths for domain-specific terms and fails if insurance brokerage language leaks into framework code.

## Design rule

New vertical functionality must be exposed through a small facade before integration into customer-service, API, or WhatsApp layers.

Preferred pattern:

1. domain model
2. repository/query
3. service
4. formatter
5. facade
6. customer-service integration
7. API/WhatsApp parity tests

This keeps the framework reusable while still allowing real business verticals to prove product value.
