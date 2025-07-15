export type BucketName = (typeof buckets)[keyof typeof buckets]["name"];

export const buckets = {
	main: {
		name:
			process.env.NEXT_PUBLIC_LOCAL_DEV === "true"
				? "sokratest-dev"
				: "sokratest",
	},
	processed: {
		name:
			process.env.NEXT_PUBLIC_LOCAL_DEV === "true"
				? "processed-files-dev"
				: "processed-files",
	},
};
