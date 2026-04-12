import { type ExtractionResult, extractBytes } from "@kreuzberg/node";
import * as Effect from "effect/Effect";
import { ProcessError } from "../errors";
import type { ExpandedExtractionConfig } from "../kreuzberg-expanded-types";
import type { ProcessSource } from "../source";
import { readSource } from "../source";
import { getExtractionProfileConfig } from "./profiles";
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

		return (yield* Effect.tryPromise({
			try: async () =>
				extractBytes(Buffer.from(input.data), input.mimeType, config),
			catch: (cause) =>
				new ProcessError({
					operation: "extractBytes",
					cause,
				}),
		})) satisfies ExtractionResult;
	});
