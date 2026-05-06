# Insurance Account Manager Alerts

The insurance brokerage vertical exposes deterministic account manager alert queries through the public insurance boundary.

Consumers must import from the public insurance barrel instead of importing vertical internals directly.

Public import path:

    import { queryAccountManagerAlerts } from "../src/insurance";

Do not import from vertical internals:

    import { queryAccountManagerAlerts } from "../src/verticals/insurance-brokerage/account-manager-alert-query-facade";

## Public query facade

Function contract:

    queryAccountManagerAlerts(query?: AccountManagerAlertQuery): AccountManagerAlertQueryResult

Supported query filters:

- policyId
- customerId
- type
- severity

The result is deterministic for the same payment-audit repository state.

Result shape:

    interface AccountManagerAlertQueryResult {
      readonly query: AccountManagerAlertQuery;
      readonly alerts: readonly AccountManagerAlert[];
      readonly alertCount: number;
    }

## Current alert types

The current account manager model derives these alert types from payment-audit records:

- missed-payment
- possible-lapse
- underwriting-review
- billing-discrepancy

## Boundary rule

The implementation lives inside the insurance brokerage vertical, but external consumers should use:

    src/insurance/index.ts

This keeps the vertical behind a stable public boundary and prevents application code from depending on internal vertical file layout.