import { describe, expect, test } from "bun:test";
import type { CapabilitySet } from "../groups";
import "../test-procedures";

const { groupsLoadedBy, loadedToolGroupsOf, loadToolsTool } = await import(
	"./load-tools"
);

const member: CapabilitySet = {
	read: true,
	create_bot: true,
	create_block: true,
	create_asset: true,
};

const load = (groups: ("bots" | "sharing" | "people")[], planApproved = true) =>
	loadToolsTool({
		capabilities: member,
		isPlanApproved: () => planApproved,
		toolLoading: {
			type: "active-tools",
		},
	}).execute(
		{
			groups,
		},
		{
			toolCallId: "call-1",
			messages: [],
			context: {},
		},
	);

describe("loadTools", () => {
	test("loads the offered groups and refuses the others", async () => {
		const output = await load([
			"bots",
			"people",
		]);

		expect(output).toEqual({
			groups: [
				{
					group: "bots",
					loaded: true,
					tools: [
						"createBot",
						"updateBot",
						"publishBot",
						"deleteBot",
						"createTemplate",
						"updateTemplate",
						"createRepository",
						"updateRepository",
						"deleteBlock",
						"updateAsset",
						"deleteAsset",
						"retryAsset",
						"requestUpload",
					],
				},
				{
					group: "people",
					loaded: false,
					error: "FORBIDDEN: This user may not use these tools.",
				},
			],
		});
		expect(groupsLoadedBy(output)).toEqual([
			"bots",
		]);
	});

	test("lists the create tools as locked until a plan is approved", async () => {
		const output = await load(
			[
				"bots",
			],
			false,
		);

		expect("groups" in output && output.groups[0]).toEqual({
			group: "bots",
			loaded: true,
			tools: [
				"updateBot",
				"publishBot",
				"deleteBot",
				"updateTemplate",
				"updateRepository",
				"deleteBlock",
				"updateAsset",
				"deleteAsset",
				"retryAsset",
				"requestUpload",
			],
			lockedUntilPlanApproved: [
				"createBot",
				"createTemplate",
				"createRepository",
			],
		});
	});

	test("a repeated group is reported once", async () => {
		const output = await load([
			"sharing",
			"sharing",
		]);

		expect(groupsLoadedBy(output)).toEqual([
			"sharing",
		]);
		expect("groups" in output && output.groups).toHaveLength(1);
	});
});

describe("loadedToolGroupsOf", () => {
	const loadPart = (state: string, output: unknown) => ({
		type: "tool-loadTools",
		toolCallId: "call-1",
		state,
		input: {
			groups: [],
		},
		output,
	});

	test("collects the groups of successful loadTools parts in assistant rows", () => {
		expect(
			loadedToolGroupsOf([
				{
					role: "user",
					parts: [
						{
							type: "text",
							text: "Share my bot",
						},
					],
				},
				{
					role: "assistant",
					parts: [
						loadPart("output-available", {
							groups: [
								{
									group: "sharing",
									loaded: true,
									tools: [],
								},
								{
									group: "people",
									loaded: false,
									error: "FORBIDDEN",
								},
							],
						}),
					],
				},
				{
					role: "assistant",
					parts: [
						loadPart("output-error", undefined),
						loadPart("output-available", {
							groups: [
								{
									group: "bots",
									loaded: true,
									tools: [],
								},
							],
						}),
					],
				},
			]),
		).toEqual([
			"bots",
			"sharing",
		]);
	});

	test("ignores malformed outputs and other tools", () => {
		expect(
			loadedToolGroupsOf([
				{
					role: "assistant",
					parts: [
						loadPart("output-available", "bots"),
						{
							type: "tool-findBots",
							state: "output-available",
							output: {
								groups: [
									{
										group: "bots",
										loaded: true,
									},
								],
							},
						},
					],
				},
			]),
		).toEqual([]);
	});
});
