import { z } from "zod/v4";
import { organizationIdSchema, userIdSchema } from "../shared/ids";
import { createDataResponseSchema } from "../shared/responses";
import { bootstrapStatusSchema } from "./schema";

export const bootstrapStatusResponseSchema = createDataResponseSchema(
	bootstrapStatusSchema,
);

export const bootstrapInitializeResponseSchema = createDataResponseSchema(
	z.object({
		userId: userIdSchema,
		organizationId: organizationIdSchema,
	}),
);
