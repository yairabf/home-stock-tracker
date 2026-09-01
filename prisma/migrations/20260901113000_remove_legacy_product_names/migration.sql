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
        RAISE EXCEPTION 'Product name namespace contract failed: every product must have exactly one canonical name';
    END IF;
END $$;

ALTER TABLE "Product"
    DROP COLUMN "canonicalName",
    DROP COLUMN "aliases";
