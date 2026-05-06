# Insurance Vertical Boundary Inventory

This document inventories the current insurance brokerage vertical boundary.

The goal is to keep the deterministic-agent-system framework reusable while allowing the insurance vertical to prove real product value.

## Primary vertical source

The current primary vertical implementation lives in:

- src/verticals/insurance-brokerage

Compatibility/public barrel:

- src/insurance/index.ts

Known responsibilities:

- policy coverage domain types
- deterministic coverage catalog
- policy-specific coverage examples
- policy coverage explanation
- insurance policy repository
- coverage lookup service
- customer-facing coverage response formatting
- coverage query facade
- account manager alert derivation

## Vertical tests

The primary vertical test suite lives in:

- tests/insurance

Known coverage:

- coverage explainer
- policy repository
- coverage service
- coverage response formatter
- coverage query facade
- account manager alerts

## Domain data fixtures

Current domain data fixtures live in:

- data/insurance-policies.json
- data/payment-audit-records.json
- data/products.json
- data/policies.json
- data/knowledge-base.json
- data/orders.json

These files are vertical or demo fixtures. They must not become framework-core dependencies.

## Business context packs

Current business context packs live in:

- config/business-context/customer-service-core.json
- config/business-context/customer-service-payment-audit.json

These files are domain/customer-service configuration and should be treated as vertical integration assets, not framework core.

## Integration boundary

The vertical may be integrated through customer-service, API, and WhatsApp tests when the test explicitly proves end-to-end behavior.

Allowed integration tests:

- customer-service agent tests proving vertical responses
- customer-service API tests proving vertical response parity
- WhatsApp webhook/async tests proving channel parity

The integration layer should call vertical facades instead of importing lower-level vertical internals.

Preferred import direction:

- customer-service integration -> src/insurance/* facade
- channel/API tests -> customer-service integration

Avoid:

- core framework modules importing insurance files
- agent-run importing insurance files
- storage/session/tools importing insurance files
- contracts importing insurance files

## Migration note

The current implementation location is src/verticals/insurance-brokerage. The src/insurance/index.ts file remains as a compatibility/public barrel.

A future migration may move this vertical to one of:

- src/verticals/insurance-brokerage
- plugins/insurance-brokerage
- examples/insurance-brokerage

Do not perform that migration in one large move. Use small commits with compatibility tests.

## Current architectural status

The core boundary is protected by:

- tests/architecture/core-domain-boundary.test.ts

The intended boundary is documented by:

- docs/architecture/core-vertical-boundary.md

This inventory complements those files by making the current insurance vertical footprint explicit.
