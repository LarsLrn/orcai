import z from "zod/v4";
import { statusSchema } from "@/lib/orpc/schemas/shared";
import {
	databaseBlockTaskInsertSchema,
	taskInsertSchema,
	taskSelectSchema,
	taskUpdateSchema,
} from "@/lib/orpc/schemas/task";
import { base } from "./base";

export const createDatabaseBlockVectorStoreContract = base
	.route({
		method: "POST",
		path: "/tasks/blocks/database",
		summary: "Create a database block vector store task",
		tags: ["Tasks"],
	})
	.input(databaseBlockTaskInsertSchema)
	.output(statusSchema);

export const listTasksContract = base
	.route({
		method: "GET",
		path: "/tasks",
		summary: "List tasks",
		tags: ["Tasks"],
	})
	.input(taskSelectSchema.pick({ resourceId: true }))
	.output(z.object({ data: z.array(taskSelectSchema), rowCount: z.number() }));

export const createTaskContract = base
	.route({
		method: "POST",
		path: "/tasks",
		summary: "Create a task",
		tags: ["Tasks"],
	})
	.input(taskInsertSchema)
	.output(z.object({ data: taskSelectSchema }));

export const updateTaskContract = base
	.route({
		method: "PUT",
		path: "/tasks/{resourceId}",
		summary: "Update a task",
		tags: ["Tasks"],
	})
	.input(taskUpdateSchema)
	.output(z.object({ data: taskSelectSchema }));
