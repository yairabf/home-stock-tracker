# Feature: Household profile

**From build-plan:** feature 5
**Status:** complete

## Goal

Store household composition (adults, children) and prediction preferences (confidence threshold, product policies) in a `Household` table, and expose CRUD endpoints to manage these settings. This foundational data will be used by later features (6-9) for consumption-rate estimation and prediction tuning.

## Design reference

None - this is a backend-only feature with no UI.

## In scope

- Prisma schema for `Household` model with fields defined in project-overview.md
- Database migration for the new table
- NestJS module, service, and controller for household management
- REST API endpoints: `GET /api/v1/household`, `POST /api/v1/household`, `PATCH /api/v1/household/:id`
- DTOs for request/response validation
- Unit tests for service layer business logic
- Single-household MVP constraint enforcement (at most one household record)

## Out of scope

- Multi-household support (post-MVP)
- Per-member profiles (post-MVP)
- Family access controls (post-MVP)
- Authentication/authorization (feature 16)
- Consumption prediction logic (features 6-9)

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them, so progress survives a context clear: a fresh
session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1 - Prisma schema and migration** - Add `Household` model to prisma/schema.prisma with all fields from project-overview.md, run migration. *Done when:* migration file exists, Prisma client regenerated, `npx prisma migrate dev` succeeds.
- [x] **Step 2 - Household module scaffold** - Create `src/household/` module with `household.module.ts`, `household.service.ts`, `household.controller.ts`, register in `app.module.ts`. *Done when:* module compiles, app starts, no routes registered yet.
- [x] **Step 3 - DTOs and validation** - Create `CreateHouseholdDto`, `UpdateHouseholdDto`, `HouseholdResponseDto` in `src/household/dto/` with class-validator constraints. *Done when:* DTOs exist with proper validation decorators, types match Prisma schema.
- [x] **Step 4 - Service layer with single-household enforcement** - Implement `HouseholdService` methods: `getOrCreate()` (returns existing or creates default), `create()`, `update()`. Enforce single-household constraint (reject second household creation). *Done when:* service methods exist, single-household logic in place.
- [x] **Step 5 - REST endpoints** - Implement controller routes: `GET /api/v1/household`, `POST /api/v1/household`, `PATCH /api/v1/household/:id` with proper HTTP status codes. *Done when:* endpoints work via curl/HTTP client, return expected DTOs.
- [x] **Step 6 - Service unit tests** - Add unit tests to `household.service.spec.ts` covering: getOrCreate returns existing household, create prevents duplicate households, update modifies fields, validation errors rejected. *Done when:* `npm run test -- household.service.spec.ts` passes.

## Files / areas

- `prisma/schema.prisma` - add `Household` model
- `prisma/migrations/<timestamp>_add_household/migration.sql` - auto-generated
- `src/generated/prisma/models.ts` - auto-generated from schema
- `src/household/household.module.ts` - new module
- `src/household/household.service.ts` - service with business logic
- `src/household/household.controller.ts` - REST endpoints
- `src/household/dto/create-household.dto.ts` - POST request body
- `src/household/dto/update-household.dto.ts` - PATCH request body
- `src/household/dto/household-response.dto.ts` - response shape
- `src/household/household.service.spec.ts` - unit tests
- `src/app.module.ts` - register HouseholdModule

## Data / contracts

### Household model (Prisma)

```prisma
model Household {
  id                          String   @id @default(uuid())
  adultsCount                 Int      @default(2)
  childrenCount               Int      @default(3)
  childAgeGroups              String[]
  predictionPreferences       Json?
  suggestionConfidenceThreshold Float  @default(0.7)
  productPolicies             Json?
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt
}
```

Key constraints:
- Single-row table for MVP (enforced in service layer)
- `adultsCount` and `childrenCount` must be >= 0 (validation in DTO)
- `suggestionConfidenceThreshold` range: 0.0 - 1.0 (validation in DTO)
- `predictionPreferences` and `productPolicies` are JSON for flexibility (schema TBD by later features)

### REST API contracts

**GET /api/v1/household**
- Response 200: `HouseholdResponseDto`
- Returns the single household record (creates default if none exists)

**POST /api/v1/household**
- Request body: `CreateHouseholdDto`
- Response 201: `HouseholdResponseDto`
- Response 409: Conflict if household already exists

**PATCH /api/v1/household/:id**
- Request body: `UpdateHouseholdDto`
- Response 200: `HouseholdResponseDto`
- Response 404: Not found if no household with given id

## Testing

Test runner configured: Yes (Jest via `npm run test`)

In-scope logic requiring unit tests:
- `HouseholdService.getOrCreate()` - returns existing household if present, creates default otherwise
- `HouseholdService.create()` - rejects duplicate household creation (single-household constraint)
- `HouseholdService.update()` - modifies household fields correctly
- DTO validation - adultsCount >= 0, childrenCount >= 0, suggestionConfidenceThreshold in [0.0, 1.0]

Manual verification:
- Start app with `npm run start:dev`
- Test endpoints with curl or HTTP client
- Verify single-household constraint via POST request sequence

## Notes for the AI

- Match existing NestJS patterns from `grocery/`, `product/`, `inventory/` modules
- Use PrismaService for database access (inject via constructor)
- Use class-validator decorators in DTOs (`@Min()`, `@Max()`, `@IsOptional()`, etc.)
- Follow the DTO response pattern from `GroceryItemResponseDto` (static `fromEntity` method)
- Single-household enforcement is business logic in the service, not a unique constraint in DB
- Default values: adultsCount=2, childrenCount=3, suggestionConfidenceThreshold=0.7 (from project-overview)
- No authentication required yet (feature 16)
- Use `@ApiTags('household')` decorator for Swagger grouping (if Swagger is configured)
