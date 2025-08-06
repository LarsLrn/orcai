import { statusSchema } from "@/lib/orpc/schemas/shared";
import {
	databaseBlockTaskInsertSchema,
	taskInsertSchema,
} from "@/lib/orpc/schemas/task";
import { base } from "./base";

export const createAssetTaskContract = base
	.route({
		method: "POST",
		path: "/tasks/assets",
		summary: "Create an asset task",
		tags: ["Tasks"],
	})
	.input(taskInsertSchema)
	.output(statusSchema);

export const createDatabaseBlockVectorStoreContract = base
	.route({
		method: "POST",
		path: "/tasks/blocks/database",
		summary: "Create a database block vector store task",
		tags: ["Tasks"],
	})
	.input(databaseBlockTaskInsertSchema)
	.output(statusSchema);
