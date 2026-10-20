import { describe, expect, test } from "bun:test";
import {
	ASSISTANT_TOOL_GROUPS,
	ASSISTANT_TOOL_KINDS,
	type AssistantToolName,
	activeAssistantToolNames,
	type CapabilitySet,
	DEFERRED_TOOL_GROUPS,
	offeredToolGroups,
} from "./groups";

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
};
const admin: CapabilitySet = {
	...manager,
	manage_organization: true,
	manage_providers: true,
	manage_models: true,
	manage_quotas: true,
};

const coreWithoutMembers = ASSISTANT_TOOL_GROUPS.core.filter(
	(name) => name !== "listMembers",
);

const createTools: AssistantToolName[] = [
	"createBot",
	"createTemplate",
	"createRepository",
	"createGroup",
];

describe("activeAssistantToolNames", () => {
	test("a viewer gets the eleven core tools and no loadTools", () => {
		const names = activeAssistantToolNames(viewer, DEFERRED_TOOL_GROUPS, true);

		expect(names).toHaveLength(11);
		expect(names).toEqual(
			coreWithoutMembers.filter((name) => name !== "loadTools"),
		);
		expect(offeredToolGroups(viewer)).toEqual([]);
	});

	test("a member starts with core without listMembers, plus loadTools", () => {
		const names = activeAssistantToolNames(member, [], false);

		expect(names).toHaveLength(12);
		expect(names).toEqual([
			...coreWithoutMembers,
		]);
		expect(offeredToolGroups(member)).toEqual([
			"bots",
			"sharing",
		]);
	});

	test("a member's loaded groups add their tools, people adds nothing", () => {
		expect(
			activeAssistantToolNames(member, DEFERRED_TOOL_GROUPS, true),
		).toEqual([
			...coreWithoutMembers,
			...ASSISTANT_TOOL_GROUPS.bots,
			...ASSISTANT_TOOL_GROUPS.sharing,
		]);
		expect(
			activeAssistantToolNames(
				member,
				[
					"people",
				],
				true,
			),
		).toEqual(activeAssistantToolNames(member, [], true));
	});

	test("loaded groups keep the group order, whatever the load order", () => {
		expect(
			activeAssistantToolNames(
				member,
				[
					"sharing",
					"bots",
				],
				true,
			),
		).toEqual(activeAssistantToolNames(member, DEFERRED_TOOL_GROUPS, true));
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
		expect(activeAssistantToolNames(capabilities, [], false)).toEqual([
			...ASSISTANT_TOOL_GROUPS.core,
		]);

		const names = activeAssistantToolNames(
			capabilities,
			DEFERRED_TOOL_GROUPS,
			true,
		);

		expect(names).toHaveLength(41);
		expect(names).toEqual([
			...ASSISTANT_TOOL_GROUPS.core,
			...ASSISTANT_TOOL_GROUPS.bots,
			...ASSISTANT_TOOL_GROUPS.sharing,
			...ASSISTANT_TOOL_GROUPS.people,
		]);
		expect(offeredToolGroups(capabilities)).toEqual([
			"bots",
			"sharing",
			"people",
		]);
	});

	test("invite_members alone offers only the invitation tools of people", () => {
		const capabilities: CapabilitySet = {
			...viewer,
			invite_members: true,
		};

		expect(
			activeAssistantToolNames(capabilities, DEFERRED_TOOL_GROUPS, true),
		).toEqual([
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
		const names = activeAssistantToolNames(
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
			activeAssistantToolNames(
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
			activeAssistantToolNames(
				{
					...viewer,
					create_bot: false,
					manage_members: false,
				},
				DEFERRED_TOOL_GROUPS,
				true,
			),
		).toEqual(activeAssistantToolNames(viewer, DEFERRED_TOOL_GROUPS, true));
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
			const approved = activeAssistantToolNames(
				capabilities,
				DEFERRED_TOOL_GROUPS,
				true,
			);
			const unapproved = activeAssistantToolNames(
				capabilities,
				DEFERRED_TOOL_GROUPS,
				false,
			);

			expect(approved.filter((name) => createTools.includes(name))).toEqual(
				expected,
			);
			expect(unapproved.filter((name) => createTools.includes(name))).toEqual(
				[],
			);
			expect(unapproved).toEqual(
				approved.filter((name) => !createTools.includes(name)),
			);
		},
	);

	test("requestUpload stays available before a plan is approved", () => {
		expect(ASSISTANT_TOOL_KINDS.requestUpload).toBe("widget");
		expect(
			activeAssistantToolNames(
				member,
				[
					"bots",
				],
				false,
			),
		).toContain("requestUpload");
	});

	test("the create kind is exactly the four create tools", () => {
		expect(
			Object.entries(ASSISTANT_TOOL_KINDS)
				.filter(([, kind]) => kind === "create")
				.map(([name]) => name)
				.sort(),
		).toEqual(
			[
				...createTools,
			].sort(),
		);
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
		expect(activeAssistantToolNames(capabilities, [], false)).toContain(
			"updatePlan",
		);
	});
});
