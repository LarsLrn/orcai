import type { AssetId } from "@orcai/core";
import { createUuidIdSchema } from "../shared/id-schema";

export const assetIdSchema = createUuidIdSchema<AssetId>();
