export const qdrantCollections = {
	asset: {
		name:
			process.env.NODE_ENV === "production"
				? "sokratest-v2-chunks-PROD"
				: "sokratest-v2-chunks-DEV",
		dimensions: 4096,
		index: {
			repositoryId: "repository_id",
			chunkIndex: "chunkIndex",
		},
	},
};
