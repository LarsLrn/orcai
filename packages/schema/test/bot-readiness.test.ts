import { describe, expect, test } from "bun:test";
import { type BotReadinessBlock, botReadinessIssues } from "../src";

const behaviour = (
	status: BotReadinessBlock["status"] = "ready",
): BotReadinessBlock => ({
	type: "behaviour",
	name: "Behaviour",
	status,
	assetCount: 0,
});

const repository = (
	name: string,
	status: BotReadinessBlock["status"],
	assetCount: number,
): BotReadinessBlock => ({
	type: "repository",
	name,
	status,
	assetCount,
});

describe("botReadinessIssues", () => {
	test("a ready behaviour and ready repositories holding assets make a ready bot", () => {
		expect(
			botReadinessIssues([
				behaviour(),
				repository("Handbook", "ready", 2),
			]),
		).toEqual([]);
	});

	test("lists every reason, the behaviour first", () => {
		expect(
			botReadinessIssues([
				repository("Draft", "draft", 1),
				repository("Empty", "ready", 0),
			]),
		).toEqual([
			{
				reason: "BOT_BEHAVIOUR_BLOCK_REQUIRED",
			},
			{
				reason: "BOT_REPOSITORY_NOT_READY",
				params: {
					blockName: "Draft",
				},
			},
			{
				reason: "BOT_REPOSITORY_EMPTY",
				params: {
					blockName: "Empty",
				},
			},
		]);
	});

	test("a draft behaviour is not ready", () => {
		expect(
			botReadinessIssues([
				behaviour("draft"),
			]),
		).toEqual([
			{
				reason: "BOT_BEHAVIOUR_BLOCK_NOT_READY",
			},
		]);
	});
});
