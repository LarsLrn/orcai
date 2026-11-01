import { describe, expect, test } from "bun:test";
import {
	providerCompaction,
	providerToolLoading,
	type ToolLoading,
} from "@orcai/ai";
import { tool } from "ai";
import { z } from "zod/v4";
import {
	ASSISTANT_TOOL_GROUPS,
	type AssistantToolName,
	type CapabilitySet,
	DEFERRED_TOOL_GROUPS,
	DEFERRED_TOOL_NAMES,
	type DeferredToolGroup,
	offeredToolGroups,
} from "@/lib/ai/tools/assistant/groups";
import { createAssistantSession } from "./assistant-session";

const viewer: CapabilitySet = {
	read: true,
};
const member: CapabilitySet = {
	...viewer,
	create_bot: true,
	create_block: true,
	create_asset: true,
};
const manager: CapabilitySet = {
	...member,
	manage_members: true,
	manage_groups: true,
	invite_members: true,
	install_resource: true,
};
const admin: CapabilitySet = {
	...manager,
	manage_organization: true,
	manage_providers: true,
	manage_models: true,
	manage_quota_pools: true,
	view_analytics: true,
};

const activeTools: ToolLoading = {
	type: "active-tools",
};
const references = providerToolLoading("anthropic", "claude-opus-5-5");

/** The bots tools only admins and managers, who add from the catalogue, are offered. */
const installerTools: readonly string[] = [
	"addFromCatalogue",
	"removeFromOrganisation",
];
const coreWithoutMembers = ASSISTANT_TOOL_GROUPS.core.filter(
	(name) => name !== "listMembers",
);
const createTools: AssistantToolName[] = [
	"createBot",
	"createBehaviour",
	"createRepository",
	"createGroup",
];

type Part = {
	type: string;
	toolCallId?: string;
	state?: string;
	input?: unknown;
	output?: unknown;
};

type Execution = {
	toolCallId: string;
	toolName: string;
	output: unknown;
};

const ran = (
	toolName: string,
	output: unknown,
	toolCallId: string,
): Execution => ({
	toolCallId,
	toolName,
	output,
});

const stored = (call: Part | Execution): Part =>
	"toolName" in call
		? {
				type: `tool-${call.toolName}`,
				toolCallId: call.toolCallId,
				state: "output-available",
				input: {},
				output: call.output,
			}
		: call;

const loadOutput = (groups: readonly DeferredToolGroup[]) => ({
	groups: groups.map((group) => ({
		group,
		loaded: true,
		tools: [],
	})),
});

const loaded = (groups: readonly DeferredToolGroup[], id = "load") =>
	ran("loadTools", loadOutput(groups), id);

const approved = (id = "plan") =>
	ran(
		"updatePlan",
		{
			updated: true,
		},
		id,
	);

/** A session over one stored reply holding `calls`. */
const sessionOf = (
	capabilities: CapabilitySet,
	calls: (Part | Execution)[] = [],
	toolLoading: ToolLoading = activeTools,
) =>
	createAssistantSession({
		history: [
			{
				parts: calls.map(stored),
			},
		],
		capabilities,
		toolLoading,
		compaction: providerCompaction("anthropic", 100_000),
	});

/** The active tools once `groups` are loaded, with or without an approved plan. */
const activeWith = (
	capabilities: CapabilitySet,
	groups: readonly DeferredToolGroup[],
	planApproved: boolean,
) =>
	sessionOf(capabilities, [
		loaded(groups),
		...(planApproved
			? [
					approved(),
				]
			: []),
	]).activeTools();

describe("active tools", () => {
	test("a viewer gets the thirteen core tools and no loadTools", () => {
		const names = activeWith(viewer, DEFERRED_TOOL_GROUPS, true);

		expect(names).toEqual(
			coreWithoutMembers.filter((name) => name !== "loadTools"),
		);
		expect(names).toHaveLength(13);
		expect(offeredToolGroups(viewer)).toEqual([]);
	});

	test("a member starts with core without listMembers, plus loadTools", () => {
		expect(sessionOf(member).activeTools()).toEqual([
			...coreWithoutMembers,
		]);
		expect(offeredToolGroups(member)).toEqual([
			"bots",
			"sharing",
		]);
	});

	test("a member's loaded groups add their tools, people adds nothing", () => {
		expect(activeWith(member, DEFERRED_TOOL_GROUPS, true)).toEqual([
			...coreWithoutMembers,
			...ASSISTANT_TOOL_GROUPS.bots.filter(
				(name) => !installerTools.includes(name),
			),
			...ASSISTANT_TOOL_GROUPS.sharing,
		]);
		expect(
			activeWith(
				member,
				[
					"people",
				],
				true,
			),
		).toEqual(activeWith(member, [], true));
	});

	test("loaded groups keep the group order, whatever the load order", () => {
		expect(
			activeWith(
				member,
				[
					"sharing",
					"bots",
				],
				true,
			),
		).toEqual(activeWith(member, DEFERRED_TOOL_GROUPS, true));
	});

	test.each([
		[
			"manager",
			manager,
		],
		[
			"admin",
			admin,
		],
	])("a %s gets every tool once every group is loaded", (_, capabilities) => {
		expect(sessionOf(capabilities).activeTools()).toEqual([
			...ASSISTANT_TOOL_GROUPS.core,
		]);
		expect(activeWith(capabilities, DEFERRED_TOOL_GROUPS, true)).toEqual([
			...ASSISTANT_TOOL_GROUPS.core,
			...ASSISTANT_TOOL_GROUPS.bots,
			...ASSISTANT_TOOL_GROUPS.sharing,
			...ASSISTANT_TOOL_GROUPS.people,
		]);
		expect(offeredToolGroups(capabilities)).toEqual(DEFERRED_TOOL_GROUPS);
	});

	test("invite_members alone offers only the invitation tools of people", () => {
		const capabilities: CapabilitySet = {
			...viewer,
			invite_members: true,
		};

		expect(activeWith(capabilities, DEFERRED_TOOL_GROUPS, true)).toEqual([
			...coreWithoutMembers,
			"inviteMembers",
			"listInvitations",
			"cancelInvitation",
		]);
		expect(offeredToolGroups(capabilities)).toEqual([
			"people",
		]);
	});

	test("requestUpload needs create_asset, the other bots tools any content capability", () => {
		const names = activeWith(
			{
				...viewer,
				create_bot: true,
			},
			DEFERRED_TOOL_GROUPS,
			true,
		);

		expect(names).toContain("createBot");
		expect(names).not.toContain("requestUpload");
		expect(
			activeWith(
				{
					...viewer,
					create_asset: true,
				},
				DEFERRED_TOOL_GROUPS,
				true,
			),
		).toContain("requestUpload");
	});

	test("a capability set to false offers nothing", () => {
		expect(
			activeWith(
				{
					...viewer,
					create_bot: false,
					manage_members: false,
				},
				DEFERRED_TOOL_GROUPS,
				true,
			),
		).toEqual(activeWith(viewer, DEFERRED_TOOL_GROUPS, true));
	});

	test("reads the groups of successful loads, not refused groups, failed calls or other tools", () => {
		const session = sessionOf(member, [
			ran(
				"loadTools",
				{
					groups: [
						{
							group: "sharing",
							loaded: true,
							tools: [],
						},
						{
							group: "bots",
							loaded: false,
							error: "FORBIDDEN",
						},
					],
				},
				"load-1",
			),
			{
				type: "tool-loadTools",
				toolCallId: "load-2",
				state: "output-error",
				input: {},
			},
			ran("loadTools", "bots", "load-3"),
			ran("findBots", loadOutput(DEFERRED_TOOL_GROUPS), "find"),
		]);

		expect(session.activeTools()).toEqual([
			...coreWithoutMembers,
			...ASSISTANT_TOOL_GROUPS.sharing,
		]);
	});

	test("with references, every offered tool from the start", () => {
		const session = sessionOf(member, [], references);

		expect(session.activeTools()).toEqual(
			activeWith(member, DEFERRED_TOOL_GROUPS, true),
		);
	});
});

describe("plan approval", () => {
	test.each([
		[
			"member",
			member,
			createTools.filter((name) => name !== "createGroup"),
		],
		[
			"manager",
			manager,
			createTools,
		],
		[
			"admin",
			admin,
			createTools,
		],
	])(
		"a %s's create tools wait for an approved plan",
		(_, capabilities, expected) => {
			const withPlan = activeWith(capabilities, DEFERRED_TOOL_GROUPS, true);
			const withoutPlan = activeWith(capabilities, DEFERRED_TOOL_GROUPS, false);

			expect(withPlan.filter((name) => createTools.includes(name))).toEqual(
				expected,
			);
			expect(withoutPlan).toEqual(
				withPlan.filter((name) => !createTools.includes(name)),
			);
		},
	);

	test("requestUpload stays available before a plan is approved", () => {
		expect(
			activeWith(
				member,
				[
					"bots",
				],
				false,
			),
		).toContain("requestUpload");
	});

	test.each([
		[
			"viewer",
			viewer,
		],
		[
			"member",
			member,
		],
		[
			"manager",
			manager,
		],
		[
			"admin",
			admin,
		],
	])("a %s gets updatePlan with no group loaded", (_, capabilities) => {
		expect(sessionOf(capabilities).activeTools()).toContain("updatePlan");
	});

	test("a stored plan counts once it ran, not while it waits or after a denial", () => {
		const waiting: Part = {
			type: "tool-updatePlan",
			toolCallId: "waiting",
			state: "approval-requested",
			input: {},
		};
		const denied: Part = {
			type: "tool-updatePlan",
			toolCallId: "denied",
			state: "output-denied",
			input: {},
		};

		expect(sessionOf(member).isPlanApproved()).toBe(false);
		expect(
			sessionOf(member, [
				waiting,
				denied,
			]).isPlanApproved(),
		).toBe(false);
		expect(
			sessionOf(member, [
				approved(),
			]).isPlanApproved(),
		).toBe(true);
	});

	test("an approval unlocks the loaded groups' create tools, once", () => {
		const session = sessionOf(member, [
			loaded([
				"bots",
			]),
		]);

		expect(session.unlockedByApproval()).toEqual([
			"createBot",
			"createBehaviour",
			"createRepository",
		]);
		session.record(approved());
		expect(session.unlockedByApproval()).toEqual([]);
	});

	test("asks for exactly the fifteen confirming tools and updatePlan", () => {
		expect(Object.keys(sessionOf(member).toolApproval).sort()).toEqual(
			[
				"deleteBot",
				"deleteBlock",
				"deleteAsset",
				"generateAssetMetadata",
				"addFromCatalogue",
				"removeFromOrganisation",
				"deleteGroup",
				"revokeAccess",
				"removeGroupMembers",
				"removeMembers",
				"cancelInvitation",
				"grantAccess",
				"addGroupMembers",
				"changeMemberRole",
				"inviteMembers",
				"updatePlan",
			].sort(),
		);
	});

	test("the confirming tools always ask; updatePlan until a plan is approved", () => {
		const session = sessionOf(member);
		const { updatePlan, ...confirming } = session.toolApproval;

		expect(updatePlan()).toBe("user-approval");
		session.record(approved());
		expect(updatePlan()).toBe("not-applicable");
		for (const approval of Object.values(confirming)) {
			expect(approval).toBe("user-approval");
		}
	});

	test.each([
		[
			"active tools",
			activeTools,
		],
		[
			"references",
			references,
		],
	])(
		"with %s, a create tool refuses until a plan is approved",
		async (_, toolLoading) => {
			const session = sessionOf(member, [], toolLoading);
			const { createBot, findBots } = session.declare({
				createBot: tool({
					inputSchema: z.object({}),
					execute: () => "created",
				}),
				findBots: tool({
					inputSchema: z.object({}),
					execute: () => "found",
				}),
			});
			const options = {
				toolCallId: "call",
				messages: [],
				context: {},
			};

			expect(() => createBot.execute?.({}, options)).toThrow(
				"PLAN_NOT_APPROVED",
			);
			expect(await findBots.execute?.({}, options)).toBe("found");
			session.record(approved());
			expect(await createBot.execute?.({}, options)).toBe("created");
		},
	);
});

describe("tool list changes", () => {
	test("loading changes the list once per group; refused groups change nothing", () => {
		const session = sessionOf(member);

		session.record(
			loaded(
				[
					"bots",
				],
				"first",
			),
		);
		session.record(
			loaded(
				[
					"bots",
				],
				"again",
			),
		);
		session.record(
			ran(
				"loadTools",
				{
					groups: [
						{
							group: "people",
							loaded: false,
							error: "FORBIDDEN",
						},
					],
				},
				"refused",
			),
		);

		expect([
			...session.toolListChanges,
		]).toEqual([
			"first",
		]);
	});

	test("the approval changes the list where it unlocks create tools; later plan updates do not", () => {
		const unloaded = sessionOf(member);
		unloaded.record(approved("approval"));
		const session = sessionOf(member, [
			loaded([
				"bots",
			]),
		]);
		session.record(approved("approval"));
		session.record(approved("progress"));

		expect([
			...unloaded.toolListChanges,
		]).toEqual([]);
		expect([
			...session.toolListChanges,
		]).toEqual([
			"load",
			"approval",
		]);
	});

	test("with references, nothing changes the list", () => {
		const session = sessionOf(
			member,
			[
				loaded([
					"bots",
				]),
			],
			references,
		);
		session.record(approved());

		expect(session.toolListChanges.size).toBe(0);
	});
});

describe("declared tools", () => {
	const declared = (toolLoading: ToolLoading) =>
		sessionOf(member, [], toolLoading).declare(
			Object.fromEntries(
				[
					"findBots",
					"updateBot",
					"listAccess",
				].map((name) => [
					name,
					tool({
						inputSchema: z.object({}),
					}),
				]),
			),
		);

	test("with references, the group tools are deferred", () => {
		for (const [name, declaredTool] of Object.entries(declared(references))) {
			expect(declaredTool.providerOptions !== undefined).toBe(
				DEFERRED_TOOL_NAMES.has(name),
			);
		}
	});

	test("with active tools, none is deferred", () => {
		for (const declaredTool of Object.values(declared(activeTools))) {
			expect(declaredTool.providerOptions).toBeUndefined();
		}
	});
});

describe("model output", () => {
	const output = {
		updated: true,
	};

	test("with references, references the offered tools after the output", () => {
		const modelOutput = sessionOf(member, [], references).modelOutput(output, [
			"createBot",
			"createGroup",
		]);

		expect(modelOutput).toEqual({
			type: "content",
			value: [
				{
					type: "text",
					text: JSON.stringify(output),
				},
				expect.objectContaining({
					type: "custom",
					providerOptions: {
						anthropic: expect.objectContaining({
							toolName: "createBot",
						}),
					},
				}),
			],
		});
	});

	test("with active tools, or nothing to reference, the output alone", () => {
		expect(
			sessionOf(member).modelOutput(output, [
				"createBot",
			]),
		).toEqual({
			type: "json",
			value: output,
		});
		expect(
			sessionOf(member, [], references).modelOutput(output, [
				"createGroup",
			]),
		).toEqual({
			type: "json",
			value: output,
		});
	});
});
