import {
	type ExtractionConfig,
	type ExtractionResult,
	extractBytes,
} from "@kreuzberg/node";
import * as Effect from "effect/Effect";
import { ProcessError } from "./errors";
import { readSource } from "./source";
import type { ProcessSource } from "./types";

const DEFAULT_CONFIG = {
	useCache: true,
	enableQualityProcessing: true,
} satisfies ExtractionConfig;

export const extract = (
	source: ProcessSource,
	options?: {
		config?: ExtractionConfig;
	},
) =>
	Effect.gen(function* () {
		const resolvedSource = source;

		const input = yield* readSource(resolvedSource);
		const config = {
			...DEFAULT_CONFIG,
			...options?.config,
		};

		return (yield* Effect.tryPromise({
			try: async () =>
				extractBytes(Uint8Array.from(input.data), input.mimeType, config),
			catch: (cause) =>
				new ProcessError({
					operation: "extractBytes",
					cause,
				}),
		})) satisfies ExtractionResult;
	});
