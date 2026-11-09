import { describe, expect, test } from "bun:test";
import type { BotId, QuotaPoolId } from "@orcai/core";
import type { QuotaStatus } from "@orcai/schema";
import { composerBlocker } from "./composer-blocker";

const resetsAt = new Date("2026-11-01T00:00:00Z");

const covered = (usedShare: number): QuotaStatus => ({
	available: true,
	pool: {
		id: crypto.randomUUID() as QuotaPoolId,
		name: "Everyone",
		usedShare,
		periodEndsAt: resetsAt,
	},
});

const uncovered: QuotaStatus = {
	available: false,
	pool: null,
};

describe("composerBlocker", () => {
	test("a missing model wins over any quota state", () => {
		for (const quota of [
			undefined,
			uncovered,
			covered(1),
		]) {
			expect(
				composerBlocker({
					modelAvailable: false,
					quota,
				}),
			).toEqual({
				reason: "model",
			});
		}
	});

	test("no covering pool wins over exhaustion", () => {
		expect(
			composerBlocker({
				modelAvailable: true,
				quota: uncovered,
			}),
		).toEqual({
			reason: "quota",
		});
	});

	test("a used-up pool blocks until it resets", () => {
		expect(
			composerBlocker({
				modelAvailable: true,
				quota: covered(1),
			}),
		).toEqual({
			reason: "exhausted",
			resetsAt,
		});
	});

	test("a pool with budget left, or a status still loading, blocks nothing", () => {
		expect(
			composerBlocker({
				modelAvailable: true,
				quota: covered(0.99),
			}),
		).toBeUndefined();
		expect(
			composerBlocker({
				modelAvailable: true,
				quota: undefined,
			}),
		).toBeUndefined();
	});

	test("a bot's required model blocks when missing, unusable or uncovered, but not when only used up", () => {
		const botId = crypto.randomUUID() as BotId;
		const blocked = {
			reason: "bot-model" as const,
			botId,
		};
		expect(
			composerBlocker({
				modelAvailable: true,
				quota: covered(0),
				requiredBy: {
					botId,
					usable: false,
				},
			}),
		).toEqual(blocked);
		expect(
			composerBlocker({
				modelAvailable: false,
				quota: uncovered,
				requiredBy: {
					botId,
					usable: true,
				},
			}),
		).toEqual(blocked);
		expect(
			composerBlocker({
				modelAvailable: true,
				quota: covered(1),
				requiredBy: {
					botId,
					usable: true,
				},
			}),
		).toEqual({
			reason: "exhausted",
			resetsAt,
		});
		expect(
			composerBlocker({
				modelAvailable: true,
				quota: undefined,
				requiredBy: {
					botId,
					usable: true,
				},
			}),
		).toBeUndefined();
	});
});
