import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type { z } from "zod/v4";

export type ModelListingFailure =
	| "unauthorized"
	| "unsupported"
	| "unreachable"
	| "invalid-response"
	/** Another error status. */
	| "rejected";

/** Why a provider's model list could not be read, as far as its answer says. */
export class ModelListingError extends Data.TaggedError("ModelListingError")<{
	readonly failure: ModelListingFailure;
	/** The error status the provider answered with. */
	readonly status?: number;
	readonly cause?: unknown;
}> {}

const failureOfStatus = (status: number): ModelListingFailure => {
	if (status === 401 || status === 403) return "unauthorized";
	if (status === 404) return "unsupported";
	if (status >= 500) return "unreachable";
	return "rejected";
};

/** The JSON a models API answers a GET with; interrupting the effect aborts the request and its body. */
export const getListing = (
	fetch: typeof globalThis.fetch,
	url: string | URL,
	headers: Record<string, string>,
) =>
	Effect.tryPromise({
		try: async (signal): Promise<unknown> => {
			const response = await fetch(url, {
				headers,
				signal,
			}).catch((cause: unknown) => {
				throw new ModelListingError({
					failure: "unreachable",
					cause,
				});
			});
			if (!response.ok) {
				throw new ModelListingError({
					failure: failureOfStatus(response.status),
					status: response.status,
				});
			}
			return await response.json().catch((cause: unknown) => {
				throw new ModelListingError({
					failure:
						cause instanceof SyntaxError ? "invalid-response" : "unreachable",
					cause,
				});
			});
		},
		catch: (cause) =>
			cause instanceof ModelListingError
				? cause
				: new ModelListingError({
						failure: "unreachable",
						cause,
					}),
	});

export const decodeListing = <T>(schema: z.ZodType<T>, body: unknown) => {
	const result = schema.safeParse(body);
	return result.success
		? Effect.succeed(result.data)
		: Effect.fail(
				new ModelListingError({
					failure: "invalid-response",
					cause: result.error,
				}),
			);
};
