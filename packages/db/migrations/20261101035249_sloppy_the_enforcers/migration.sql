-- Only Library assets go into repositories, so chat uploads a repository already holds join the Library.
UPDATE "asset" SET "origin" = 'library'
WHERE "origin" = 'chat' AND "id" IN (SELECT "asset_id" FROM "block_asset");
