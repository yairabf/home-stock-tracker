BEGIN;

DO $$
DECLARE
    zero_count BIGINT;
    negative_count BIGINT;
    nan_count BIGINT;
    positive_infinity_count BIGINT;
    negative_infinity_count BIGINT;
BEGIN
    SELECT
        count(*) FILTER (WHERE "requestedQuantity" = 0),
        count(*) FILTER (
            WHERE "requestedQuantity" < 0
              AND "requestedQuantity" <> '-Infinity'::DOUBLE PRECISION
        ),
        count(*) FILTER (WHERE "requestedQuantity" = 'NaN'::DOUBLE PRECISION),
        count(*) FILTER (WHERE "requestedQuantity" = 'Infinity'::DOUBLE PRECISION),
        count(*) FILTER (WHERE "requestedQuantity" = '-Infinity'::DOUBLE PRECISION)
    INTO
        zero_count,
        negative_count,
        nan_count,
        positive_infinity_count,
        negative_infinity_count
    FROM "GroceryListItem"
    WHERE "requestedQuantity" IS NOT NULL;

    IF zero_count > 0
        OR negative_count > 0
        OR nan_count > 0
        OR positive_infinity_count > 0
        OR negative_infinity_count > 0
    THEN
        RAISE EXCEPTION USING MESSAGE = format(
            'Grocery quantity contract failed: zero=%s, negative=%s, nan=%s, positive_infinity=%s, negative_infinity=%s',
            zero_count,
            negative_count,
            nan_count,
            positive_infinity_count,
            negative_infinity_count
        );
    END IF;
END $$;

UPDATE "GroceryListItem"
SET "requestedQuantity" = 1
WHERE "requestedQuantity" IS NULL;

ALTER TABLE "GroceryListItem"
    ALTER COLUMN "requestedQuantity" SET DEFAULT 1,
    ALTER COLUMN "requestedQuantity" SET NOT NULL;

ALTER TABLE "GroceryListItem"
    ADD CONSTRAINT "GroceryListItem_requestedQuantity_positive_finite_check"
    CHECK (
        "requestedQuantity" > 0
        AND "requestedQuantity" <> 'NaN'::DOUBLE PRECISION
        AND "requestedQuantity" <> 'Infinity'::DOUBLE PRECISION
        AND "requestedQuantity" <> '-Infinity'::DOUBLE PRECISION
    );

COMMIT;
