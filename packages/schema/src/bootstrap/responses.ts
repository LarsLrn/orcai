import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import { createDataResponseSchema } from "../shared";
import { userIdSchema } from "../user/ref";
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
