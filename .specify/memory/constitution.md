<!--
SYNC IMPACT REPORT
Version change: unversioned template → 1.0.0 (initial ratification)
Bump rationale: MAJOR — first concrete adoption; all placeholder governance replaced with
binding rules.

Modified principles (placeholder → concrete):
- [PRINCIPLE_1_NAME] → I. Spec-Driven Development (NON-NEGOTIABLE)
- [PRINCIPLE_2_NAME] → II. Test-First (NON-NEGOTIABLE)
- [PRINCIPLE_3_NAME] → III. Simplicity and YAGNI
- [PRINCIPLE_4_NAME] → IV. Observability and Debuggability
- [PRINCIPLE_5_NAME] → V. Security and Data Protection

Added sections:
- Web Application Constraints (was [SECTION_2_NAME])
- Development Workflow (was [SECTION_3_NAME])
- Governance (populated)

Removed sections: none

Deferred items / follow-up TODOs:
- TODO(TECH_STACK): the concrete stack, hosting target, and supported browser matrix are not yet
  chosen. Fill in under "Web Application Constraints" at the first /speckit-plan, then amend as a
  PATCH or MINOR bump depending on whether new constraints are introduced.
-->

# diklass Constitution

## Core Principles

### I. Spec-Driven Development (NON-NEGOTIABLE)

Every feature MUST begin as a written specification before any implementation exists. The order
`spec → plan → tasks → code` is binding: no task may be executed that does not trace to a task
entry, and no task entry may exist that does not trace to an approved spec.

Changes to intended behaviour MUST be made in the spec first and then propagated forward; code is
never the authoritative record of what the system is supposed to do. Bug fixes and trivial chores
(dependency bumps, formatting, typo corrections) are exempt from requiring a full spec but MUST
still be reviewed.

Rationale: the specification is the only artifact that survives refactors, rewrites, and personnel
changes. When code is the sole source of truth, intent is unrecoverable and every future change
becomes archaeology.

### II. Test-First (NON-NEGOTIABLE)

Tests MUST be written before the implementation they cover, MUST be observed to fail for the
intended reason, and only then may implementation proceed. The Red-Green-Refactor cycle is
enforced, not advisory.

Every bug fix MUST open with a failing regression test that reproduces the reported defect. No
change may be merged while any test is failing, and tests MUST NOT be skipped or disabled to
achieve a green run — a test that is wrong is deleted with justification, never silently muted.

Rationale: a test written after the implementation tests what the code does, not what it should do.
Writing it first is the only way to distinguish a specification from a description.

### III. Simplicity and YAGNI

The simplest implementation that satisfies the spec MUST be preferred. Abstractions, indirection
layers, configuration switches, and new services are introduced only when a current, concrete
requirement demands them — never in anticipation of a hypothetical future one.

Every new runtime dependency, every new architectural layer, and every deviation from the
established project pattern MUST be justified in writing in the plan's complexity tracking before
it is introduced. "We might need it later" is not a justification.

Rationale: speculative generality is the dominant source of long-lived accidental complexity. Code
that does not exist has no bugs, no maintenance cost, and no migration burden.

### IV. Observability and Debuggability

Server-side code MUST emit structured, machine-parseable logs carrying a request or trace
correlation identifier that follows a unit of work end to end. Errors MUST be logged with enough
context to reproduce the failure without access to the original request.

Failures MUST NOT be silently swallowed: every caught exception is either handled meaningfully,
re-raised, or logged at an appropriate severity. Client-side errors MUST be reported to a central
sink rather than left in the user's console.

Rationale: a web application fails in production, on machines you cannot attach a debugger to, for
users who will not file a report. Observability is the only channel through which those failures
become fixable.

### V. Security and Data Protection

Secrets MUST NOT appear in source control, in client-side bundles, or in logs; they are supplied
exclusively through environment configuration. All input crossing a trust boundary MUST be
validated and, where rendered, escaped.

Authentication and authorization MUST be enforced server-side on every protected operation — client
checks are a usability affordance and never a control. Dependencies MUST be scanned for known
vulnerabilities, and personal data MUST be collected only where a spec states a need for it.

Rationale: security defects differ from other defects in that they are exploited deliberately, are
often silent until they are catastrophic, and cannot be retrofitted onto an architecture that
assumed trust.

## Web Application Constraints

User-facing views MUST meet WCAG 2.2 Level AA: keyboard operability for every interactive control,
programmatic labels on form inputs, visible focus indication, and text contrast at or above the
required ratio. Accessibility is a merge gate, not a backlog item.

Interfaces MUST be responsive across the supported viewport range and MUST remain usable without
JavaScript-dependent layout thrash on first paint. Performance budgets are set per feature in its
plan and verified before merge; a feature that regresses an agreed budget does not ship.

TODO(TECH_STACK): the concrete language, framework, datastore, hosting target, and supported
browser matrix are not yet selected. These MUST be recorded here at the first `/speckit-plan` and
this constitution amended accordingly.

## Development Workflow

Work proceeds through the Spec Kit flow: `/speckit-specify` to capture intent, `/speckit-plan` to
choose an approach, `/speckit-tasks` to decompose it, and `/speckit-implement` to execute. The
`/speckit-analyze` cross-artifact check SHOULD be run before implementation begins on any feature
spanning more than a handful of tasks.

Every change proposed for merge MUST be reviewed by someone other than its author, and the review
MUST explicitly verify compliance with the Core Principles above. Automated gates — the full test
suite, linting, type checking, and dependency vulnerability scanning — MUST pass before review
concludes; a red pipeline is not overridden by reviewer approval.

Agent-assisted development follows the same gates as human-authored work. Runtime development
guidance for coding agents lives in `CLAUDE.md` at the repository root; that file describes how to
work in this codebase and never overrides the rules in this constitution.

## Governance

This constitution supersedes all other development practices, conventions, and habits. Where a
tool's default, a framework idiom, or an existing file conflicts with a principle stated here, this
document wins and the conflict is resolved by changing the code.

Amendments MUST be proposed as a written change to this file, reviewed like any other change, and
accompanied by a migration note when existing code is placed out of compliance. Versioning follows
semantic versioning: MAJOR for the removal or backward-incompatible redefinition of a principle,
MINOR for a newly added principle or materially expanded guidance, PATCH for clarifications and
wording that do not change obligations.

Compliance is reviewed continuously at merge time rather than in a periodic audit. Any complexity
admitted under Principle III MUST carry its recorded justification for as long as it remains in the
codebase; when the justification stops being true, the complexity is removed.

**Version**: 1.0.0 | **Ratified**: 2026-09-09 | **Last Amended**: 2026-09-09
