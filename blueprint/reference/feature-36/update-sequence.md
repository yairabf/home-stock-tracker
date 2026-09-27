# Feature 36: proposed rollout and Hermes verification sequence

**Status:** prepared; post-update replay timing needs user approval. No commit,
merge, push, image publication, skill installation, or remote change performed.

## Confirmed update path

- User: Hermes reads the GitHub repository to update its skill. Watchtower pulls
  the service image after main publication.
- Repository origin: https://github.com/yairabf/home-stock-tracker.
- `.github/workflows/verify.yml` runs Verify and image checks, then publishes the
  passing main image to `ghcr.io/yairabf/home-stock-tracker:sha-<commit>` and
  promotes latest only if that commit is still current main.
- Existing descriptions and schemas are backwards compatible. This feature has
  no database migration or deployment-configuration changes.

## Proposed sequence

1. Approve moving actual Hermes replay from a pre-completion gate to an explicit
   post-update verification gate. Local tests, contract checks, and isolated
   PostgreSQL proof have passed. Record agent behavior as unverified until replay.
2. Run the repository completion/review process with that approved gate adjustment;
   request merge approval and separate push approval as required. Preserve
   unrelated existing workflow edits for review; do not silently discard them.
3. After an authorized main push, verify GitHub checks and image publication.
   Watchtower then updates the remote service through the user's existing setup.
   Confirm readiness and fresh MCP discovery before user mutations.
4. Ask Hermes to install the complete generated bundle from main, reload skills,
   and refresh MCP tool discovery. Confirm actual versions: skill 1.17.1 and
   description contract 1.7.1. Reading the GitHub files alone is not installation
   evidence. Use the existing read-only agent probe where supported.
5. Run the prepared isolated Hermes replay from `hermes-replay.md`; obtain raw
   tool arguments/results and state evidence. Record the result before declaring
   the reported conversation failure resolved. Do not automatically replay the
   historical seasoning mutation against the live household.

## Prepared message for Hermes after publication

Update the Home Stock Tracker integration from main in
https://github.com/yairabf/home-stock-tracker. Install the complete
integrations/hermes/home-stock-tracker bundle into the active profile and reload
its skill. Refresh MCP tool discovery after the service image update. Confirm
skill version 1.17.1 and description contract 1.7.1 against the generated manifest
and actual discovered descriptions. Use the read-only installation probe if
available. Report those checks before making any mutation. Then prepare an
isolated test conversation for the feature-36 recovery cases; preserve existing
household data and do not replay earlier successful additions.
