import { z } from "zod/v4";

/** Where an asset was uploaded: the library, or a chat message's attachments. */
export const ASSET_ORIGINS = [
	"library",
	"chat",
] as const;

export const assetOriginSchema = z.enum(ASSET_ORIGINS);

export type AssetOrigin = z.infer<typeof assetOriginSchema>;
