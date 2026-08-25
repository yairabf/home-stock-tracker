# Coding Standards

> NestJS is the selected framework and npm is the package manager. The
> persistence layer and supporting integrations remain TODO until configured.

## TypeScript

- Stock Nest CLI `tsconfig.json`: `strictNullChecks` is on, but full `strict`
  mode is not - `noImplicitAny` and `strictBindCallApply` are off.
- ESLint currently allows `any` (`@typescript-eslint/no-explicit-any` is off)
  and only warns, rather than errors, on `no-floating-promises` and
  `no-unsafe-argument`.
- Define interfaces for all props, API responses, and data models regardless.
- Use type inference where obvious, explicit types where helpful.

> TODO: tighten `tsconfig.json` (`"strict": true`) and turn
> `@typescript-eslint/no-explicit-any` back into an error if/when stricter
> typing is wanted. Flagging this now rather than silently loosening the
> standard to match the scaffold.

## NestJS

- Organize business capabilities into focused modules.
- Use controllers for HTTP transport and services for business logic.
- Use dependency injection through NestJS providers rather than constructing
  dependencies inside services.
- Use DTO classes for request and response boundaries.
- Use guards for authentication and authorization, pipes for validation and
  transformation, and interceptors for cross-cutting concerns.
- Keep persistence and third-party integrations behind injectable providers.
- Keep controllers thin and return explicit response types.

## File Organization

- NestJS modules: `src/[feature]/[feature].module.ts`
- Controllers: `src/[feature]/[feature].controller.ts`
- Services: `src/[feature]/[feature].service.ts`
- DTOs: `src/[feature]/dto/[name].dto.ts`
- Entities or models: `src/[feature]/entities/` or the persistence layer's
  established convention
- Shared types and utilities: `src/common/`
- Application bootstrap: `src/main.ts`

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## API and Data

- Expose HTTP behavior through versioned controllers when versioning is needed.
- Validate request DTOs with `class-validator` and transform them with
  `class-transformer` when those packages are configured.
- Keep database access behind a dedicated provider or repository boundary.
- Scope every user-owned query by the authenticated user id; never trust a
  client-supplied user id.
- Use the persistence layer's migration workflow for schema changes. The
  specific database and ORM are TODO until configured.

## Error Handling

- Use NestJS exception classes and a consistent global exception filter where
  appropriate.
- Return a stable API response shape for successful and failed operations.
- Do not expose internal stack traces or provider details in client responses.

## Testing

The blueprint installs no test runner; testing is opt-in at the project level,
because the overlay can't know your stack. Adding unit testing is an explicit
setup task the AI can do through the normal workflow, either as a build-plan item
or with `/tests`. The setup should choose the stack-native runner, wire the
scripts or commands, add a small example test, and update the Commands section
of `AGENTS.md`.

When `AGENTS.md` declares a `Verify` command, treat it as the umbrella automated
gate. It combines only the checks this project actually has, in this order when
available: typecheck, tests, then build. The command does not enable an absent
test runner or replace focused evidence. It gives local work and optional CI one
exact command to run. `/ci` owns Verify and CI setup. `/tests` adds the real test
command to Verify when it already exists, but never creates CI only because
testing was configured.

**The opt-in switch is one signal: a `test` command in the Commands section of
`AGENTS.md`.** Declare one and **tests become a gate for logic-bearing steps**,
not an optional extra; leave it out and the loop verifies logic with the evidence
it already uses (run it, a screenshot, the build). Adding the runner is itself a
deliberate step, never a silent mid-step install. This is the single definition
of the switch; the skills and `ai-interaction.md` only point back here.

- **What to test (the scope rule):** pure logic where a wrong answer is possible -
  parsers, formatters, validators, id/slug builders, server actions. These have
  assertable inputs and outputs and real edge cases (empty, missing, malformed).
- **What not to test:** UI components and integration-level surfaces (render or
  export routes, anything driving a real browser or external service). Verify those
  with a screenshot and the build, not brittle unit tests.
- **The gate (when a runner is configured):** a build step that adds in-scope logic
  must ship a passing test in the same reviewable diff. The project's test command
  must be green before the step is approved, before any checkpoint commit, and
  before `/complete` merges. UI and integration-only steps are exempt and ride on
  screenshot plus build evidence.
- **When it's named:** the `/feature` spec's Testing section predicts the coverage,
  `/implement` writes the test with the step, and if a step surfaces logic the spec
  didn't foresee, add a focused test then.
- An empty suite should fail, not pass, so "no tests ran" never looks like "passed".
- Test files live next to source files (for example `feature.test.ts`).
- Run them via the project's test command (see Commands in `AGENTS.md`), not a
  hardcoded tool name.

Stack binding (swap for yours): a TypeScript app uses Vitest, `vi.mock()` for
external dependencies (Prisma, Clerk, etc.), and `vi.useFakeTimers()` for
time-dependent logic; a Python app would use pytest; a Go app `go test`.

## Browser Verification

> Browser verification: TODO until a browser-facing client or documented
> Playwright setup exists. NestJS HTTP behavior can be verified with the existing
> Jest and Supertest setup.

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible

## Comments

Write code that explains itself; comment only what the code cannot say.
Over-commenting is a common AI tell, so resist it.

- Comment the **why**, not the **what**. Delete any comment that restates the code.
- No banner/header blocks, section dividers, or step-by-step narration of obvious
  code. A file does not need a comment announcing each region.
- A comment earns its place only when it captures something the code can't: a
  non-obvious decision, a gotcha or workaround, why a value is what it is, or a
  link to a spec or issue.
- Prefer self-documenting names and small functions over explanatory comments.
- Keep doc comments minimal: a one-line purpose on an exported type or function is
  plenty; don't write JSDoc that just repeats the signature.
- When in doubt, leave the comment out.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs. They read as AI-generated.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
