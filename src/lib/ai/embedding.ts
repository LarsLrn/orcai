import { embed } from "ai";
import * as Effect from "effect/Effect";
import { AiError } from "@/lib/effect/utils/errors";
import { getSaiaEmbeddingModel } from "./saia-models";

export const generateEmbedding = (value: string) =>
	Effect.gen(function* () {
		const input = value.replaceAll("\\n", " ");

		return yield* Effect.tryPromise({
			try: () =>
				embed({
					model: getSaiaEmbeddingModel({
						model: "e5-mistral-7b-instruct",
					}).provider,
					value: input,
				}),
			catch: (cause) =>
				new AiError({
					operation: "generateEmbedding",
					cause,
				}),
		});
	});
