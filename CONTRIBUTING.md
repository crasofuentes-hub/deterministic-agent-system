# Contributing

Thank you for your interest in contributing.

This repository is focused on building a deterministic autonomous agent system with strong engineering discipline around auditability, bounded behavior, and reproducible verification.

## Core Contribution Principles

Contributions should improve one or more of the following:

- determinism
- execution correctness
- auditability
- replayability
- contract clarity
- testability
- documentation precision

## Before You Start

Please read the README and existing documentation before proposing large changes.

When in doubt, prefer:
- explicit behavior over implicit behavior
- stable interfaces over convenience abstractions
- verifiable outcomes over subjective claims

## Development Environment (Current Baseline)

- Windows PowerShell 5.1 (primary documented workflow)
- TypeScript
- Node.js + npm

## Contribution Types

### 1) Documentation improvements
Examples:
- architecture clarifications
- execution model explanations
- better examples
- verification workflow documentation

### 2) Testing and verification improvements
Examples:
- smoke tests
- negative-path tests
- deterministic regression checks
- script hardening

### 3) Contract hardening
Examples:
- response schema validation
- deterministic error payload improvements
- adapter conformance checks

### 4) Implementation improvements
Examples:
- deterministic execution controls
- trace tooling
- replay support
- bounded iteration logic

## Pull Request Expectations

Please keep pull requests focused and clearly scoped.

A good pull request should include:

- What changed
- Why it changed
- What assumptions were made
- How it was validated
- Any determinism or contract implications

## Coding Guidelines (Current Direction)

- Prefer explicit control flow
- Avoid hidden side effects
- Keep boundary behavior visible and testable
- Use stable, machine-parseable outputs where relevant
- Document assumptions and constraints

## Testing and Validation

When adding behavior, include validation where possible:
- build checks
- tests
- smoke checks
- deterministic behavior checks (when applicable)

## Documentation Standards

Documentation should be:
- technically precise
- explicit about limitations
- clear about guarantees vs goals
- written in professional English for public repository readers

## Issues and Discussions

Use issues for:
- bugs
- improvements
- documentation problems
- contract drift
- verification failures

When reporting a bug, include:
- reproduction steps
- environment details
- expected result
- actual result
- relevant logs or outputs

## Security Issues

Please do not file sensitive security issues as public issues. See SECURITY.md for reporting guidance.