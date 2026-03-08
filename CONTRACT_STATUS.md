# CONTRACT_STATUS

## Interface Contract Verification Status

- Generated (UTC): 2026-03-08T08:25:30.547Z
- Scope: Error response samples + live `/agent/run` contract and determinism checks
- Overall status: **PASS**

### Checks

#### Required file exists: docs\error-codes.md
- Status: **PASS**
- DurationMs: 0

#### Required file exists: schemas\error-response.schema.json
- Status: **PASS**
- DurationMs: 0

#### Required file exists: samples\error-response.valid.json
- Status: **PASS**
- DurationMs: 0

#### Required file exists: samples\error-response.invalid.missing-code.json
- Status: **PASS**
- DurationMs: 0

#### Read valid sample JSON
- Status: **PASS**
- DurationMs: 0

#### Read invalid sample JSON
- Status: **PASS**
- DurationMs: 0

#### Valid sample passes shape validation
- Status: **PASS**
- DurationMs: 0

#### Invalid sample fails shape validation
- Status: **PASS**
- DurationMs: 0

#### Invalid sample reports missing error.code
- Status: **PASS**
- DurationMs: 1

#### POST /agent/run success returns HTTP 200
- Status: **PASS**
- DurationMs: 0

#### POST /agent/run success matches minimum result shape
- Status: **PASS**
- DurationMs: 0

#### POST /agent/run invalid request returns HTTP 400
- Status: **PASS**
- DurationMs: 0

#### POST /agent/run invalid request matches error shape
- Status: **PASS**
- DurationMs: 0

#### POST /agent/run llm-live stub returns HTTP 200
- Status: **PASS**
- DurationMs: 0

#### POST /agent/run llm-live stub matches minimum result shape
- Status: **PASS**
- DurationMs: 0

#### POST /agent/run llm-live stub repeated request returns HTTP 200
- Status: **PASS**
- DurationMs: 0

#### POST /agent/run llm-live stub repeated request preserves planHash/executionHash/finalTraceLinkHash
- Status: **PASS**
- DurationMs: 0

### Notes

- JSON Schema file is present and versioned.
- Validation is implemented in TypeScript for cross-platform execution.
- Verification now includes live `/agent/run` success, invalid request, `llm-live` stub checks, and repeated-request determinism checks.
