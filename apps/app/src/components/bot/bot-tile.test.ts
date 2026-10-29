import { describe, expect, mock, test } from "bun:test";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	client: {},
	orpc: {},
}));

const { botContentsLabel, botModelHintBadge } = await import("./bot-tile");

describe("botContentsLabel", () => {
	test("names the behaviour and counts repositories", () => {
		expect(
			botContentsLabel({
				behaviour: true,
				repositories: 2,
			}),
		).toBe("Behaviour + 2 repositories");
		expect(
			botContentsLabel({
				behaviour: true,
				repositories: 0,
			}),
		).toBe("Behaviour");
		expect(
			botContentsLabel({
				behaviour: false,
				repositories: 1,
			}),
		).toBe("1 repository");
	});

	test("a bot without blocks is the model only", () => {
		expect(
			botContentsLabel({
				behaviour: false,
				repositories: 0,
			}),
		).toBe("Model only");
	});
});

describe("botModelHintBadge", () => {
	test("a required model warns, a recommended one hints", () => {
		expect(
			botModelHintBadge({
				strength: "required",
				modelName: "GPT-6.1",
			}),
		).toEqual({
			label: "Requires GPT-6.1",
			variant: "warning",
		});
		expect(
			botModelHintBadge({
				strength: "recommended",
				modelName: "Claude Sonnet 5.5",
			}),
		).toEqual({
			label: "Tuned for Claude Sonnet 5.5",
			variant: "outline",
		});
		expect(botModelHintBadge(null)).toBeNull();
	});
});
