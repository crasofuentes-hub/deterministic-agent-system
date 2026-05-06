# Vertical Isolation Status

This document records the current architectural status of the insurance brokerage vertical isolation.

## Summary

The insurance brokerage implementation is no longer treated as framework core.

The current architecture separates:

- framework/core code
- vertical/domain implementation
- compatibility/public barrel
- customer-service/API/WhatsApp integration tests

## Current vertical location

Primary vertical implementation:

- src/verticals/insurance-brokerage

Compatibility/public barrel:

- src/insurance/index.ts

The public barrel allows existing integrations to import through a stable boundary while the implementation remains physically isolated under src/verticals.

## Architecture guards

The boundary is enforced by:

- tests/architecture/core-domain-boundary.test.ts
- tests/architecture/vertical-public-boundary.test.ts

The first guard prevents insurance brokerage language from leaking into framework/core paths.

The second guard prevents production code outside the vertical from importing src/verticals/insurance-brokerage internals directly.

## Relevant commits

- fe49786 test(architecture): guard core against insurance domain coupling
- 19f020d docs(architecture): document core and vertical boundary
- 8d30df1 docs(architecture): inventory insurance vertical boundary
- 32003bb refactor(insurance): add vertical boundary barrel
- c98c050 refactor(verticals): move insurance source behind vertical boundary
- 6f519aa docs(architecture): update insurance vertical location
- cc720a9 test(architecture): guard vertical imports through public boundary

## Current baseline

Expected contractual baseline after this isolation work:

- 31 test files
- 268 tests

Command:

    npm run test:baseline:contractual

## Interpretation

The project still contains a strong insurance brokerage vertical, but it is now isolated from the reusable deterministic agent framework.

This reduces domain lock-in risk because vertical growth can continue behind a documented and tested boundary instead of contaminating core framework modules.

## Remaining work

Recommended next steps:

1. Keep new insurance functionality under src/verticals/insurance-brokerage.
2. Keep production integrations importing through src/insurance/index.ts.
3. Avoid adding insurance references to core paths.
4. Consider a future move from src/insurance/index.ts to a generic plugin registry once more verticals exist.
5. Add at least one domain-agnostic demo or example to balance external positioning.
