import { z } from "zod/v4";
import { createDataResponseSchema } from "../shared";
import { entityCapabilitiesSchema } from "./schema";

export const authorizationCheckResponseSchema = createDataResponseSchema(
	z.object({
		allowed: z.boolean(),
	}),
);

export const authorizationCheckManyResponseSchema = createDataResponseSchema(
	z.object({
		entities: z.record(z.string(), entityCapabilitiesSchema),
	}),
);

export const organizationCapabilitiesResponseSchema = createDataResponseSchema(
	z.object({
		capabilities: entityCapabilitiesSchema,
	}),
);
