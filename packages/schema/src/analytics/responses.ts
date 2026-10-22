import { createDataResponseSchema } from "../shared";
import { instanceAnalyticsSchema, organizationAnalyticsSchema } from "./views";

export const organizationAnalyticsResponseSchema = createDataResponseSchema(
	organizationAnalyticsSchema,
);

export const instanceAnalyticsResponseSchema = createDataResponseSchema(
	instanceAnalyticsSchema,
);
