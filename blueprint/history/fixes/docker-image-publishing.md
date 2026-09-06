# Current Feature

> **Generated file.** Holds the one feature, fix, or rollback being built right now. Run
> `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
> an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
> Build one thing at a time; `/complete` archives it under
> `blueprint/history/` and resets this file.

## Docker image publishing

**Type:** Fix
**Status:** verified
**Completed:** 2026-09-06
**Branch:** `feature/docker-image-publishing`

Publish public GHCR images after passing main checks, supporting AMD64 and
ARM64. Consumers update explicitly through release Compose, with migration and
app pinned to the same pulled digest. No automatic host deployment.

- [x] Add shared Verify and PR/main workflow with main-only publishing,
  commit tags, platform validation, and serialized current-main latest promotion.
- [x] Add release Compose and fail-fast digest-pinned update helper.
- [x] Document registry activation, consumer updates, pinning, and recovery.
- [x] Run Verify and script failure-path checks.
- [x] Apply user clarification: image builds run in GitHub CI; local Docker
  runtime acceptance is outside the completion gate.
- [x] Record remaining remote validation: first GHCR publish, platform manifest,
  public visibility activation, anonymous pull, and actual workflow triggers.

User explicitly clarified CI-only delivery and authorized commit, merge, push,
and activation in chat. No running consumer deployment is changed.

This is an unnumbered CI configuration change, archived as a fix; no existing
build-plan feature is marked complete by it.

## Verification evidence

- `npm run verify`: 67 suites and 929 tests passed; Nest production build passed.
  Existing HTTP tests required local port access outside the sandbox.
- Five new release-helper tests prove digest consistency and ordering, stop on
  pull/migration failure, refusal of missing digest, and readiness failure reporting.
- Release Compose `config --quiet` passed using synthetic credentials and
  `--env-file /dev/null`; workflow YAML parsed with its main/Verify gate intact.
- Scoped ESLint, Prettier checks, shell syntax, and `git diff --check` passed.
- `graphify update .` completed; SQL extraction reported its existing missing
  optional parser dependency.
- Two-platform Docker build attempted twice. Prisma engine download failed with
  `unable to get local issuer certificate` (AMD64 on first attempt, ARM64 on
  second). Installing standard CA certificates did not resolve it; that trial
  change was removed. TLS verification remains enabled. Host HTTPS access works,
  but Docker's download path remains unverified. No acceptance database was
  created, and container migration/readiness/persistence checks remain pending.
- Actual GitHub event behavior, registry platform manifest, and anonymous GHCR
  pulls require the workflow to be pushed and its first publication to run.

## Final completion gate

- `npm run verify` passed again: 67 suites, 929 tests, production build.
- No findings or independent review blockers.
- Registry publication and anonymous pull are verified after pushing the workflow.
- How to try: follow `docs/deployment.md` to pull the published image and run
  `sh scripts/update-release.sh` when ready to update a consumer installation.
