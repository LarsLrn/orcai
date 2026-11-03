import { z } from "zod/v4";
import { activityRunIdSchema } from "../shared/ids";

export const prepareMissingExtractionsAgainPayloadSchema = z.object({
	/** The instance run the assets are prepared again as. */
	runId: activityRunIdSchema,
	/** The run's lease the job holds while it admits the assets. */
	leaseId: z.uuid(),
});

export type PrepareMissingExtractionsAgainPayload = z.infer<
	typeof prepareMissingExtractionsAgainPayloadSchema
>;
