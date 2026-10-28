import { z } from "zod/v4";
import { createDataResponseSchema } from "../shared";
import { instanceHealthSchema } from "./schema";

export const findInstanceHealthResponseSchema =
	createDataResponseSchema(instanceHealthSchema);

/** `queued` is false when the admin already asked within the last minute. */
export const sendTestEmailResponseSchema = z.object({
	queued: z.boolean(),
});
