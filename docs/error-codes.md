# Deterministic Error Codes

## Purpose

This document defines the error code direction for deterministic interface behavior.

A deterministic agent system must expose stable and machine-parseable failure semantics. Error codes are part of the contract and should be treated as compatibility-sensitive.

## Design Rules

1. Error codes are stable identifiers.
2. Error codes are uppercase snake case.
3. Human-readable messages may improve over time, but should remain clear and bounded.
4. Retryability is explicit and machine-parseable.
5. Equivalent failures should map to the same error code under equivalent conditions.
6. Error payload structure should remain stable across execution modes.

## Error Response Shape (Conceptual)

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

## Initial Error Code Catalog (v0 direction)

### INVALID_REQUEST
Use when input is syntactically valid JSON but fails request validation rules.

Examples:
- missing required fields
- invalid field types
- unsupported enum values

Retryable:
- false (unless request is corrected by caller)

### MALFORMED_REQUEST
Use when the request cannot be parsed or interpreted structurally.

Examples:
- malformed JSON
- invalid content format

Retryable:
- false (unless request payload is corrected)

### METHOD_NOT_ALLOWED
Use when a route exists but the HTTP method is not supported.

Retryable:
- false (caller must change method)

### NOT_FOUND
Use when the requested route or resource does not exist.

Retryable:
- false (unless caller changes target)

### ADAPTER_CONTRACT_VIOLATION
Use when an adapter returns data or behavior that violates the declared integration contract.

Retryable:
- depends on context; typically false unless transient adapter issue is explicitly identified

### EXECUTION_CONVERGENCE_FAILED
Use when bounded execution terminates without reaching a valid convergence condition.

Retryable:
- context-dependent; often false without changed configuration/input

### INTERNAL_ERROR
Use for unexpected internal failures that do not map to a more specific stable code.

Retryable:
- context-dependent (must be explicitly declared in payload)

## Compatibility Guidance

- Adding new error codes is allowed when needed.
- Renaming existing error codes is a breaking change.
- Reusing one error code for semantically different failures should be avoided.
- Error code meaning should remain stable across versions unless explicitly versioned.

## Documentation Requirement

Every new error code should be documented here before it is treated as a stable public contract.