import { extractBytes } from "@kreuzberg/node";
import * as Effect from "effect/Effect";
import { ProcessError } from "../errors";
import type { ExpandedExtractionConfig } from "../kreuzberg-expanded-types";
import { readSource } from "../source/read";
import type { ProcessSource } from "../source/types";
import { getExtractionProfileConfig } from "./profiles";
import { chunkSlides, isSlideDeck } from "./slides";
import type { ExtractionProfile } from "./types";

export const extract = (
	source: ProcessSource,
	options?: {
		profile?: ExtractionProfile;
		config?: ExpandedExtractionConfig;
	},
) =>
	Effect.gen(function* () {
		const resolvedSource = source;

		const input = yield* readSource(resolvedSource);
		const config = {
			...getExtractionProfileConfig(options?.profile),
			...options?.config,
		} satisfies ExpandedExtractionConfig;

		const result = yield* Effect.tryPromise({
			try: async () =>
				extractBytes(Buffer.from(input.data), input.mimeType, config),
			catch: (cause) =>
				new ProcessError({
					operation: "extractBytes",
					cause,
				}),
		});
		if (!config.chunking || !isSlideDeck(result)) return result;
		return yield* chunkSlides({
			result,
			data: input.data,
			mimeType: input.mimeType,
			config,
		});
	});
