import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import { referenceMatrix } from "@/components/chat/gen-ui/matrix/fixtures";
import { referenceReview } from "@/components/chat/gen-ui/review/fixtures";
import { resolveFeatures } from "./resolve-features";

const offeredTools = (features: unknown) =>
	Effect.runSync(resolveFeatures(features)).flatMap(({ entry, settings }) =>
		Object.entries(
			entry.buildTools({
				context: undefined as never,
				settings,
			}),
		),
	);

describe("featureCatalog", () => {
	test("Generative UI offers every display tool", () => {
		expect(
			offeredTools({
				generativeUi: {},
			}).map(([name]) => name),
		).toEqual([
			"showChecklist",
			"showReview",
			"showMatrix",
		]);
	});

	test("no display tool is offered with Generative UI off", () => {
		expect(offeredTools({})).toEqual([]);
	});

	test("display tools only answer that they were shown", async () => {
		const tools = Object.fromEntries(
			offeredTools({
				generativeUi: {},
			}),
		);
		for (const [name, input] of [
			[
				"showReview",
				referenceReview,
			],
			[
				"showMatrix",
				referenceMatrix,
			],
		] as const) {
			expect(
				await tools[name].execute?.(input, {
					toolCallId: name,
					messages: [],
				} as never),
			).toEqual({
				shown: true,
			});
		}
	});
});
