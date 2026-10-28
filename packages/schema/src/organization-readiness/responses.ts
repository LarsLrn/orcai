import { createDataResponseSchema } from "../shared";
import { organizationReadinessSchema } from "./schema";

export const findOrganizationReadinessResponseSchema = createDataResponseSchema(
	organizationReadinessSchema,
);
