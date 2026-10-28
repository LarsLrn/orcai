import { afterEach, describe, expect, test } from "bun:test";
import type { QuotaPoolId } from "@orcai/core";
import { cleanup, render, screen } from "@testing-library/react";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime";
import { UsageBody } from "./usage-body";
import { usageView } from "./usage-view";

const originalGetLocale = getLocale;

afterEach(() => {
	cleanup();
	overwriteGetLocale(originalGetLocale);
});

const DAY_MS = 86_400_000;

const pool = (usedShare: number) => ({
	id: crypto.randomUUID() as QuotaPoolId,
	name: "Teaching staff",
	usedShare,
	periodEndsAt: new Date(Date.now() + 3 * DAY_MS + 60_000),
});

const body = (input: Parameters<typeof usageView>[0]) => {
	overwriteGetLocale(() => "en");
	const view = usageView(input);
	if (!view) throw new Error("Expected a usage view");
	return render(<UsageBody view={view} />);
};

describe("usageView", () => {
	test("is gone without context data and without a pool", () => {
		expect(
			usageView({
				contextTokens: undefined,
				contextWindow: 128_000,
				modelName: "Model",
				pool: null,
			}),
		).toBeUndefined();
	});

	test("tints warning from 90% of the pool and danger once it is used up", () => {
		const tone = (usedShare: number) =>
			usageView({
				contextTokens: undefined,
				contextWindow: undefined,
				modelName: undefined,
				pool: pool(usedShare),
			})?.tone;

		expect(tone(0.5)).toBeUndefined();
		expect(tone(0.9)).toBe("warning");
		expect(tone(1)).toBe("danger");
	});
});

describe("UsageBody", () => {
	test("leaves out the context before a reply reports it", () => {
		body({
			contextTokens: undefined,
			contextWindow: 128_000,
			modelName: "Model",
			pool: pool(0.5),
		});

		expect(screen.queryByText("Context window")).toBeNull();
		expect(screen.getByText("Teaching staff")).toBeDefined();
		expect(screen.getByText("50% used · resets in 3d")).toBeDefined();
	});

	test("shows the context as a share of the selected model's window", () => {
		body({
			contextTokens: 74_000,
			contextWindow: 1_000_000,
			modelName: "Large model",
			pool: null,
		});

		expect(screen.getByText("Context window")).toBeDefined();
		expect(screen.getByText("Large model")).toBeDefined();
		expect(screen.getByText("7.4% used")).toBeDefined();
		expect(screen.getByText("74K / 1M tokens")).toBeDefined();
		expect(
			screen.queryByText("Earlier messages will be summarised"),
		).toBeNull();
	});

	test("shows tokens alone when the window is unknown", () => {
		body({
			contextTokens: 74_000,
			contextWindow: null,
			modelName: "Model",
			pool: null,
		});

		expect(screen.getByText("74K tokens")).toBeDefined();
		expect(screen.queryByText(/% used/)).toBeNull();
	});

	test("warns that earlier messages get summarised past the window", () => {
		body({
			contextTokens: 200_000,
			contextWindow: 128_000,
			modelName: "Small model",
			pool: null,
		});

		expect(
			screen.getByText("Earlier messages will be summarised"),
		).toBeDefined();
	});

	test("marks the pool from 90% used", () => {
		const { container } = body({
			contextTokens: undefined,
			contextWindow: undefined,
			modelName: undefined,
			pool: pool(0.9),
		});

		expect(container.querySelector("[data-low]")).not.toBeNull();
		cleanup();

		const { container: belowLow } = body({
			contextTokens: undefined,
			contextWindow: undefined,
			modelName: undefined,
			pool: pool(0.89),
		});

		expect(belowLow.querySelector("[data-low]")).toBeNull();
	});
});
