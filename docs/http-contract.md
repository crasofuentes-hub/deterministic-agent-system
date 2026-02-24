# Interface Contract Direction (HTTP)

## Purpose

This document defines the interface hardening direction for HTTP behavior in the Deterministic Agent System.

The goal is to support deterministic automation and reproducible verification by stabilizing interface semantics across success and failure paths.

## Design Goals

- explicit response schemas
- stable field naming
- consistent status semantics
- deterministic error payload shape
- cross-mode consistency where comparable
- negative-path validation

## Response Shape Principles

Responses should be:

- machine-parseable
- explicit about success or failure
- stable across equivalent conditions
- suitable for automated tests

## Success Response Direction (Conceptual)

A success response should include:

- explicit success indicator
- result payload
- metadata fields (as needed)
- stable field naming

Example conceptual shape:

    {
      "ok": true,
      "result": { ... },
      "meta": {
        "mode": "local"
      }
    }

## Error Response Direction (Conceptual)

Error behavior should be deterministic enough to support:

- retry logic
- test assertions
- operational diagnostics
- cross-environment comparisons

Target properties:

- stable error code
- explicit retryability
- consistent top-level shape
- clear but bounded human-readable message
- metadata fields with stable semantics

Example conceptual shape:

    {
      "ok": false,
      "error": {
        "code": "INVALID_REQUEST",
        "message": "Missing required field: input",
        "retryable": false
      },
      "meta": {
        "mode": "mock"
      }
    }

## Negative-Path Validation Priorities

Examples of cases to validate:

- missing required fields
- malformed JSON
- unsupported method
- unknown route
- invalid types
- contract violations at adapter boundaries

## Contract Hardening Principle

Deterministic system quality depends on deterministic interface semantics, including failure handling.
