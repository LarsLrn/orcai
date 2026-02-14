import { z } from "zod/v4";

export const taskStatus = z.enum([
	"queued",
	"processing",
	"completed",
	"failed",
	"canceled",
]);

export type TaskStatus = z.infer<typeof taskStatus>;
