import { createDataResponseSchema } from "../shared/responses";
import { instanceAnalyticsSchema, organizationAnalyticsSchema } from "./views";

export const organizationAnalyticsResponseSchema = createDataResponseSchema(
	organizationAnalyticsSchema,
);

export const instanceAnalyticsResponseSchema = createDataResponseSchema(
	instanceAnalyticsSchema,
);
