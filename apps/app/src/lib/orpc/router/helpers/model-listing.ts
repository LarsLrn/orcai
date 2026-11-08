import type { ModelListingError, ModelListingFailure } from "@orcai/ai";
import type { ErrorReason } from "@orcai/schema";
import * as AppErrors from "@/lib/effect/utils/errors";

const LISTING_FAILURE_REASONS = {
	unauthorized: "PROVIDER_MODELS_KEY_REJECTED",
	unsupported: "PROVIDER_MODELS_LISTING_UNSUPPORTED",
	unreachable: "PROVIDER_MODELS_UNREACHABLE",
	"invalid-response": "PROVIDER_MODELS_RESPONSE_INVALID",
	rejected: "PROVIDER_MODELS_FETCH_FAILED",
} as const satisfies Record<ModelListingFailure, ErrorReason>;

/** A failed model listing as the request's error. */
export const listingFailed = (message: string) => (error: ModelListingError) =>
	new AppErrors.BadRequestError({
		reason: LISTING_FAILURE_REASONS[error.failure],
		message,
		cause: error,
	});
