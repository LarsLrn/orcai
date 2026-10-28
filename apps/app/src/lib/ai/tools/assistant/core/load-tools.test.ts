import { describe, expect, test } from "bun:test";
import { providerCompaction } from "@orcai/ai";
import { createAssistantSession } from "@/lib/ai/agents/assistant-session";
import type { CapabilitySet } from "../groups";
import "../test-procedures";

const { loadToolsTool } = await import("./load-tools");

const member: CapabilitySet = {
	read: true,
	create_bot: true,
	create_block: true,
	create_asset: true,
};

const load = (groups: ("bots" | "sharing" | "people")[], planApproved = true) =>
	loadToolsTool(
		createAssistantSession({
			history: planApproved
				? [
						{
							parts: [
								{
									type: "tool-updatePlan",
									toolCallId: "plan",
									state: "output-available",
									output: {
										updated: true,
									},
								},
							],
						},
					]
				: [],
			capabilities: member,
			toolLoading: {
				type: "active-tools",
			},
			compaction: providerCompaction("openai-compatible", 100_000),
		}),
	).execute(
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
						"findModels",
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
				"findModels",
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

		expect("groups" in output && output.groups).toEqual([
			{
				group: "sharing",
				loaded: true,
				tools: [
					"listAccess",
					"findPrincipals",
					"grantAccess",
					"revokeAccess",
				],
			},
		]);
	});
});
