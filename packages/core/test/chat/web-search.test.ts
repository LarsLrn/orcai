import { describe, expect, test } from "bun:test";
import type { ProviderId } from "../../src";
import { webSearchSource } from "../../src";

const providerId = "11111111-1111-4111-8111-111111111111" as ProviderId;

describe("webSearchSource", () => {
	test("off offers no search on any model", () => {
		for (const modelKind of [
			"anthropic",
			"openai",
			"openai-compatible",
		] as const) {
			expect(
				webSearchSource({
					mode: "off",
					providerId: null,
					modelKind,
				}),
			).toEqual({
				kind: "none",
				reason: "off",
			});
		}
	});

	test("model native searches with Anthropic and OpenAI models only", () => {
		expect(
			webSearchSource({
				mode: "native",
				providerId: null,
				modelKind: "anthropic",
			}),
		).toEqual({
			kind: "native",
		});
		expect(
			webSearchSource({
				mode: "native",
				providerId: null,
				modelKind: "openai",
			}),
		).toEqual({
			kind: "native",
		});
		expect(
			webSearchSource({
				mode: "native",
				providerId: null,
				modelKind: "openai-compatible",
			}),
		).toEqual({
			kind: "none",
			reason: "model",
		});
	});

	test("off and the provider mode need no model", () => {
		expect(
			webSearchSource({
				mode: "off",
				providerId: null,
				modelKind: null,
			}),
		).toEqual({
			kind: "none",
			reason: "off",
		});
		expect(
			webSearchSource({
				mode: "provider",
				providerId,
				modelKind: null,
			}),
		).toEqual({
			kind: "provider",
			providerId,
		});
	});

	test("a search provider serves every model", () => {
		expect(
			webSearchSource({
				mode: "provider",
				providerId,
				modelKind: "openai-compatible",
			}),
		).toEqual({
			kind: "provider",
			providerId,
		});
	});

	test("the provider mode without a provider is off", () => {
		expect(
			webSearchSource({
				mode: "provider",
				providerId: null,
				modelKind: "anthropic",
			}),
		).toEqual({
			kind: "none",
			reason: "off",
		});
	});
});
