import { z } from "zod/v4";

/** Where an asset is kept: the Library, or a chat message's attachments. */
export const ASSET_KEPT_IN = [
	"library",
	"chat",
] as const;

export const assetKeptInSchema = z.enum(ASSET_KEPT_IN);

export type AssetKeptIn = z.infer<typeof assetKeptInSchema>;
