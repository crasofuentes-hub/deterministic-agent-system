# Security Policy

## Security Philosophy

This project is built around deterministic execution, auditable behavior, and explicit interface boundaries. Security issues are taken seriously, especially those that affect:

- execution correctness
- interface contract integrity
- trace integrity or auditability
- reproducibility guarantees
- unsafe side effects or boundary violations

## Reporting a Vulnerability

Please report security issues privately before public disclosure.

### Preferred contact

- Open a private security advisory on GitHub (if enabled), or
- Contact the maintainer directly through the contact information listed on the project profile

## What to include in a report

Please include as much of the following as possible:

- A clear description of the issue
- Steps to reproduce
- Affected files or components
- Expected behavior vs actual behavior
- Impact assessment
- Proof-of-concept (if safe to share)
- Environment details (OS, Node.js version, npm version, execution mode)

## Coordinated Disclosure

This project prefers responsible disclosure and coordinated remediation before public release of details.

## Scope Notes

Security issues may include, but are not limited to:

- Interface contract bypasses
- Unsafe adapter behavior
- Nondeterministic behavior that breaks verification assumptions
- Trace tampering opportunities
- Improper error disclosure
- Boundary validation failures

General feature requests or non-security bugs should be filed as standard GitHub issues.
