CREATE TYPE "ProductNameKind" AS ENUM ('canonical', 'alias');

CREATE TABLE "ProductName" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "kind" "ProductNameKind" NOT NULL,

    CONSTRAINT "ProductName_pkey" PRIMARY KEY ("id")
);

CREATE TEMPORARY TABLE "_ProductNameBackfill" ON COMMIT DROP AS
WITH "LegacyNames" AS (
    SELECT
        "id" AS "productId",
        'canonical'::"ProductNameKind" AS "kind",
        "canonicalName" AS "rawName"
    FROM "Product"
    UNION ALL
    SELECT
        product."id" AS "productId",
        'alias'::"ProductNameKind" AS "kind",
        alias."rawName"
    FROM "Product" AS product
    CROSS JOIN LATERAL unnest(product."aliases") AS alias("rawName")
),
"DisplayNames" AS (
    SELECT
        "productId",
        "kind",
        trim(both ' ' from regexp_replace(
            normalize("rawName", NFKC),
            U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',
            ' ',
            'g'
        )) AS "displayName"
    FROM "LegacyNames"
)
SELECT
    "productId",
    "kind",
    "displayName",
    lower("displayName" COLLATE "und-x-icu") AS "normalizedName"
FROM "DisplayNames";

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "_ProductNameBackfill"
        WHERE "displayName" = ''
    ) THEN
        RAISE EXCEPTION 'Product name namespace backfill failed: blank product name';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "_ProductNameBackfill"
        GROUP BY "productId", "normalizedName"
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Product name namespace backfill failed: duplicate normalized name within one product';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "_ProductNameBackfill"
        GROUP BY "normalizedName"
        HAVING count(DISTINCT "productId") > 1
    ) THEN
        RAISE EXCEPTION 'Product name namespace backfill failed: normalized name belongs to multiple products';
    END IF;
END $$;

INSERT INTO "ProductName" (
    "id",
    "productId",
    "displayName",
    "normalizedName",
    "kind"
)
SELECT
    gen_random_uuid()::text,
    "productId",
    "displayName",
    "normalizedName",
    "kind"
FROM "_ProductNameBackfill";

DO $$
BEGIN
    IF EXISTS (
        SELECT product."id"
        FROM "Product" AS product
        LEFT JOIN "ProductName" AS name
            ON name."productId" = product."id"
            AND name."kind" = 'canonical'
        GROUP BY product."id"
        HAVING count(name."id") <> 1
    ) THEN
        RAISE EXCEPTION 'Product name namespace backfill failed: every product must have exactly one canonical name';
    END IF;
END $$;

ALTER TABLE "ProductName"
    ADD CONSTRAINT "ProductName_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProductName_normalizedName_key"
    ON "ProductName"("normalizedName");
CREATE INDEX "ProductName_productId_idx"
    ON "ProductName"("productId");
CREATE UNIQUE INDEX "ProductName_one_canonical_per_product"
    ON "ProductName"("productId")
    WHERE "kind" = 'canonical';
