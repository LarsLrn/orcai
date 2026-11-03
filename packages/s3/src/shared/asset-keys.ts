/** Where an asset's file is stored, and where its upload is staged: `<prefix>/<id>.<fileType>`. */
export const assetObjectKey = (asset: {
	prefix: string;
	id: string;
	fileType: string;
}) => `${asset.prefix}/${asset.id}.${asset.fileType}`;

/** Everything processing derives from an asset lives under this prefix of the processed bucket. */
export const processedAssetPrefix = (assetId: string) => `${assetId}/`;
