import { createDataResponseSchema } from "../shared/responses";
import { organizationReadinessSchema } from "./schema";

export const findOrganizationReadinessResponseSchema = createDataResponseSchema(
	organizationReadinessSchema,
);
