import OpenAI from "openai";
import { ZodError } from "zod/v4";

export type ModelListingFailure =
	| "unauthorized"
	| "unsupported"
	| "unreachable"
	| "invalid-response";

/** Why a provider's model list could not be read, as far as its answer says. */
export class ModelListingError extends Error {
	readonly failure: ModelListingFailure;

	constructor(failure: ModelListingFailure, cause: unknown) {
		super(`Listing models failed: ${failure}`, {
			cause,
		});
		this.name = "ModelListingError";
		this.failure = failure;
	}
}

/** An error HTTP status a provider answered with. */
export class ProviderStatusError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "ProviderStatusError";
		this.status = status;
	}
}

const failureOfStatus = (status: number): ModelListingFailure | undefined => {
	if (status === 401 || status === 403) return "unauthorized";
	if (status === 404) return "unsupported";
	if (status >= 500) return "unreachable";
	return undefined;
};

const failureOf = (cause: unknown): ModelListingFailure | undefined => {
	if (cause instanceof OpenAI.APIConnectionError) return "unreachable";
	if (
		cause instanceof OpenAI.APIError ||
		cause instanceof ProviderStatusError
	) {
		return cause.status === undefined
			? undefined
			: failureOfStatus(cause.status);
	}
	if (cause instanceof ZodError || cause instanceof SyntaxError) {
		return "invalid-response";
	}
	return undefined;
};

/** The listing failure a thrown cause amounts to; causes without a class pass through. */
export const classifyListingFailure = (cause: unknown): unknown => {
	if (cause instanceof ModelListingError) return cause;
	const failure = failureOf(cause);
	return failure === undefined ? cause : new ModelListingError(failure, cause);
};
