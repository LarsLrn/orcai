import { z } from "zod/v4";
import { activityRunIdSchema } from "../shared/ids";

/** Which ready assets an instance admin prepares again: those missing their stored extraction, or all. */
export const prepareAgainScopeSchema = z.enum([
	"missing",
	"all",
]);

export type PrepareAgainScope = z.infer<typeof prepareAgainScopeSchema>;

export const prepareAssetsAgainPayloadSchema = z.object({
	/** The instance run the assets are prepared again as. */
	runId: activityRunIdSchema,
	/** The run's lease the job holds while it admits the assets. */
	leaseId: z.uuid(),
	scope: prepareAgainScopeSchema,
});

export type PrepareAssetsAgainPayload = z.infer<
	typeof prepareAssetsAgainPayloadSchema
>;
