# Feature 36 interview

**Status:** Grillme complete. User explicitly confirmed the complete shared understanding.

## Target

Issue #3: Fix MCP product-confirmation argument types.

## Existing evidence

Earlier investigation in this conversation found strict boolean and number schemas
in the server and published MCP contract. Issue #3 did not identify the failing
client/version or include a captured request. These findings do not prove a client
defect; refresh evidence when investigating the chosen repair scope.

## Agreed decisions

- Q1: preserve strict server validation; stringified primitive inputs remain invalid.
- Q2: capture client/version, approved payload, serialized request, validation error,
  and advertised schema first. Identify the first type-changing boundary before
  deciding repair ownership. User confirmed this investigation-first approach.
- Repair ownership remains an explicit implementation gate to resolve from evidence,
  not an assumed external-client fix or handoff.

- Q3: if the affected client or request trace is unavailable, pause repair until
  the failure can be captured. Strict-validation tests alone do not prove a fix.
- Q4: completion requires successful replay of the failing client flow, evidence
  that malformed inputs leave catalog/grocery state unchanged, and passing tests
  and production build.

## Open decisions

- No remaining planning decision. Repair ownership will be determined from
  captured evidence during implementation, under the agreed gate.

## Spec handling

The earlier draft was replaced after user confirmation. Agreed decisions and
implementation gates are recorded in current-feature.md; final spec review remains.

## Approved scope revision after captured evidence

- User approved revising feature 36 rather than dismissing it.
- Target: repository MCP descriptions and generated agent skills for typed
  construction and recovery within the same conversation.
- Earlier serializer-source gate is superseded for this repository guidance work.
  No external serializer defect is claimed or repaired by this feature.
- Recovery is restricted to explicitly non-invoked validation, already approved
  facts, and representation corrections. Earlier successes are not repeated;
  unknown execution or missing facts must not trigger automatic mutation retries.
- Strict validation, persistent-state evidence, and actual Hermes replay remain
  required. Missing replay access prevents completion, not local implementation.
- The current spec contains the revised gates and five implementation steps.
