import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, embedMany } from "ai";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import { AiError } from "./errors";
import { aiTelemetry } from "./telemetry";

/** An OpenAI-compatible endpoint and the embedding model it serves. */
export interface EmbeddingConnection {
	readonly baseUrl: string;
	readonly apiKey: string;
	readonly model: string;
}

const trimNewlines = (input: string) => input.replaceAll("\\n", " ");

const embeddingModel = (connection: EmbeddingConnection) =>
	createOpenAI({
		baseURL: connection.baseUrl,
		apiKey: connection.apiKey,
		name: "globalProvider",
	}).embedding(connection.model);

const embed = (
	connection: EmbeddingConnection,
	values: readonly string[],
	{
		prefix = "",
		maxRetries,
	}: {
		prefix?: string;
		maxRetries?: number;
	} = {},
) =>
	embedMany({
		model: embeddingModel(connection),
		values: values.map((value) => prefix + trimNewlines(value)),
		maxRetries,
		...aiTelemetry("ai.embedMany"),
	}).then(({ embeddings }) => embeddings);

/** One vector per value, in order, each embedded after `prefix` exactly as given. */
export const embedValues = (
	connection: EmbeddingConnection,
	values: readonly string[],
	prefix?: string,
) =>
	Effect.tryPromise({
		try: () =>
			embed(connection, values, {
				prefix,
			}),
		catch: (cause) =>
			new AiError({
				operation: "embedValues",
				cause,
			}),
	});

export type EmbeddingTestFailure =
	| "key-rejected"
	| "unreachable"
	| "model-not-found"
	| "invalid-response";

/** Why a test embedding failed, as far as the endpoint's answer says. */
export class EmbeddingTestError extends Data.TaggedError("EmbeddingTestError")<{
	readonly failure: EmbeddingTestFailure;
	readonly cause: unknown;
}> {}

const mentionsModel = (error: APICallError) =>
	/model/i.test(`${error.message} ${error.responseBody ?? ""}`);

const testFailure = (cause: unknown): EmbeddingTestFailure => {
	if (!APICallError.isInstance(cause)) return "invalid-response";
	const status = cause.statusCode;
	if (status === undefined || status >= 500) return "unreachable";
	if (status === 401 || status === 403) return "key-rejected";
	if (
		status === 404 ||
		((status === 400 || status === 422) && mentionsModel(cause))
	) {
		return "model-not-found";
	}
	return "invalid-response";
};

/** Embeds one probe value: the model's dimensions, or why the endpoint cannot embed. */
export const testEmbedding = (connection: EmbeddingConnection) =>
	Effect.tryPromise({
		try: () =>
			embed(
				connection,
				[
					"OrcAI",
				],
				{
					maxRetries: 0,
				},
			),
		catch: (cause) =>
			new EmbeddingTestError({
				failure: testFailure(cause),
				cause,
			}),
	}).pipe(
		Effect.flatMap(([vector]) =>
			Array.isArray(vector) &&
			vector.length > 0 &&
			vector.every((value) => Number.isFinite(value))
				? Effect.succeed(vector.length)
				: Effect.fail(
						new EmbeddingTestError({
							failure: "invalid-response",
							cause: new Error("The endpoint returned no usable vector"),
						}),
					),
		),
	);
