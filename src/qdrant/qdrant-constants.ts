export const qdrantCollections = {
	asset: {
		name:
			process.env.NODE_ENV === "production"
				? "sokratest-v2-chunks-PROD"
				: "sokratest-v2-chunks-DEV",
		dimensions: 4096,
		index: {
			blockId: "block_id",
			chunkIndex: "chunk_index",
		},
	},
};
