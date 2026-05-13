# AI-DLC + SDD Project Guidance

This project uses AI-DLC-inspired lifecycle control and SDD (Specification-Driven Development).

When working on this repository:

1. Start from `aidlc-docs/00-project-charter.md` for project intent and boundaries.
2. Treat `aidlc-docs/03-sdd-specification.md` as the source of truth for behavior.
3. Update specs before implementation when behavior changes.
4. Keep decisions, risks, and open questions visible in `aidlc-docs/06-decisions-risks.md`.
5. Prefer small vertical slices that include ingestion, validation, persistence, and tests.
6. Do not process real financial data into logs, sample fixtures, or generated documentation unless anonymized.

Quality gates:

- Requirements reviewed by PM and Tech Lead before implementation.
- Data contract reviewed by Backend/Data specialist before database schema changes.
- UX flows reviewed before frontend implementation.
- Security/LGPD review before any production data handling.
- Every implemented slice must include automated tests for parsing, validation, and persistence behavior.
