export type BucketName = (typeof buckets)[keyof typeof buckets]["name"];

export const buckets = {
	main: {
		name: process.env.NODE_ENV === "production" ? "sokratest" : "sokratest-dev",
	},
	processed: {
		name:
			process.env.NODE_ENV === "production"
				? "processed-files"
				: "processed-files-dev",
	},
};
