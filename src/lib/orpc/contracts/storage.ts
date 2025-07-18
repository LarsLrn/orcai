import { z } from "zod/v4";
import { base } from "./base";

export const createUploadUrlsContract = base
	.route({
		method: "POST",
		path: "/files/upload",
		summary: "Create file upload URLs",
		tags: ["Files"],
	})
	.input(
		z.object({
			courseId: z.uuidv4(),
			files: z.array(
				z.object({
					name: z.string(),
					size: z.number().int().min(1),
					type: z.string(),
				}),
			),
		}),
	)
	.output(
		z.object({
			data: z.array(
				z.object({
					id: z.string(),
					url: z.url(),
					name: z.string(),
					size: z.number(),
					type: z.string(),
				}),
			),
		}),
	);

export const createDownloadUrlContract = base
	.route({
		method: "POST",
		path: "/files/download",
		summary: "Create a file download URL",
		tags: ["Files"],
	})
	.input(
		z.object({
			id: z.uuidv4(),
			prefix: z.string(),
			bucket: z.string(),
			type: z.string(),
		}),
	)
	.output(
		z.object({
			url: z.url(),
		}),
	);
