export type BucketName = (typeof buckets)[keyof typeof buckets]["name"];

export const buckets = {
	main: {
		name: import.meta.env.PROD ? "sokratest" : "sokratest-dev",
	},
	processed: {
		name: import.meta.env.PROD ? "processed-files" : "processed-files-dev",
	},
};
