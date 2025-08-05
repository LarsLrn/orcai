import { statusSchema } from "../schemas/shared";
import { taskInsertSchema } from "../schemas/task";
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
