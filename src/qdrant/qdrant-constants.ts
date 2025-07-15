export const qdrantCollections = {
	chunks: {
		name:
			process.env.NODE_ENV === "production"
				? "sokratest-chunks-PROD"
				: "sokratest-chunks-DEV",
		dimensions: 4096,
		index: {
			courseId: "course_id",
			chunkIndex: "chunkIndex",
		},
	},
};
