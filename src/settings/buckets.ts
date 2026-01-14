import { serverEnv } from "@/lib/env/server";

export type BucketName = (typeof buckets)[keyof typeof buckets]["name"];

export const buckets = {
	main: {
		name: serverEnv.NODE_ENV === "production" ? "sokratest" : "sokratest-dev",
	},
	processed: {
		name:
			serverEnv.NODE_ENV === "production"
				? "processed-files"
				: "processed-files-dev",
	},
};
