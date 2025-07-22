export const qdrantCollections = {
	asset: {
		name:
			process.env.NODE_ENV === "production"
				? "sokratest-chunks-PROD"
				: "sokratest-chunks-DEV",
		dimensions: 4096,
		index: {
			repositoryId: "repository_id",
			chunkIndex: "chunkIndex",
		},
	},
};
