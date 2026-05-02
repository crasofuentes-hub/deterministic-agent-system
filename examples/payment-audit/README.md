# Example: Payment Audit

This example shows the deterministic payment-audit vertical used by the insurance servicing slice.

It demonstrates reproducible customer-service behavior over local deterministic data.

## Prerequisites

- Windows PowerShell
- Node.js and npm
- repository cloned locally

## Build

    Set-Location "C:\repos\deterministic-agent-system"

    npm install
    npm run build

## Run the payment-audit demo

    npm run demo:payment-audit

The demo exercises deterministic answers for:

- payment status lookup
- payment history by policy
- policy servicing guidance
- discrepancy review
- payment history by customer

## Run a focused customer payment-audit query

    npm run demo:payment-audit:customer

Representative query:

    Show me the payment history for customer CUS-101

## Data source

The vertical uses deterministic local data:

- data/payment-audit-records.json
- src/data-layer/payment-audit-repository.ts

## Business context

The business context id is:

    customer-service-payment-audit-v1

## What this proves

This example is not a generic chatbot demo. It shows:

- explicit business context selection
- deterministic data-backed answers
- stable customer-service response families
- reproducible local execution
- audit-friendly behavior for insurance payment servicing

## Verify the contractual baseline

After running the demo, verify the current contractual baseline:

    npm run test:baseline:contractual

Expected v0.5.0 baseline:

    13 test files
    191 tests
