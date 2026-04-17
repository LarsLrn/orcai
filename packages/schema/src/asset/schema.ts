import type { AssetId } from "@orcai/core";
import { createUuidIdSchema } from "../shared";

// Stub entrypoint for the asset resource migration.
export const assetIdSchema = createUuidIdSchema<AssetId>();
