import { type EmbeddingModel, embed } from "ai";
import * as Effect from "effect/Effect";
import { AiError } from "./errors";
import { getSaiaEmbeddingModel } from "./models";

export const generateEmbedding = (
	params:
		| string
		| {
				value: string;
				embeddingModel?: EmbeddingModel;
		  },
) =>
	Effect.gen(function* () {
		const value = typeof params === "string" ? params : params.value;
		const embeddingModel =
			typeof params === "string" || params.embeddingModel === undefined
				? getSaiaEmbeddingModel({
						model: "e5-mistral-7b-instruct",
					}).provider
				: params.embeddingModel;
		const input = value.replaceAll("\\n", " ");

		return yield* Effect.tryPromise({
			try: () =>
				embed({
					model: embeddingModel,
					value: input,
				}),
			catch: (cause) =>
				new AiError({
					operation: "generateEmbedding",
					cause,
				}),
		});
	});
