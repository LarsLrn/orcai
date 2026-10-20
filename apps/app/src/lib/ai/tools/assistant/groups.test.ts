import { describe, expect, test } from "bun:test";
import {
	ASSISTANT_TOOL_GROUPS,
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

describe("activeAssistantToolNames", () => {
	test("a viewer gets the ten core tools and no loadTools", () => {
		const names = activeAssistantToolNames(viewer, DEFERRED_TOOL_GROUPS);

		expect(names).toHaveLength(10);
		expect(names).toEqual(
			coreWithoutMembers.filter((name) => name !== "loadTools"),
		);
		expect(offeredToolGroups(viewer)).toEqual([]);
	});

	test("a member starts with core without listMembers, plus loadTools", () => {
		const names = activeAssistantToolNames(member, []);

		expect(names).toHaveLength(11);
		expect(names).toEqual([
			...coreWithoutMembers,
		]);
		expect(offeredToolGroups(member)).toEqual([
			"bots",
			"sharing",
		]);
	});

	test("a member's loaded groups add their tools, people adds nothing", () => {
		expect(activeAssistantToolNames(member, DEFERRED_TOOL_GROUPS)).toEqual([
			...coreWithoutMembers,
			...ASSISTANT_TOOL_GROUPS.bots,
			...ASSISTANT_TOOL_GROUPS.sharing,
		]);
		expect(
			activeAssistantToolNames(member, [
				"people",
			]),
		).toEqual(activeAssistantToolNames(member, []));
	});

	test("loaded groups keep the group order, whatever the load order", () => {
		expect(
			activeAssistantToolNames(member, [
				"sharing",
				"bots",
			]),
		).toEqual(activeAssistantToolNames(member, DEFERRED_TOOL_GROUPS));
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
		expect(activeAssistantToolNames(capabilities, [])).toEqual([
			...ASSISTANT_TOOL_GROUPS.core,
		]);

		const names = activeAssistantToolNames(capabilities, DEFERRED_TOOL_GROUPS);

		expect(names).toHaveLength(40);
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
			activeAssistantToolNames(capabilities, DEFERRED_TOOL_GROUPS),
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
			),
		).toEqual(activeAssistantToolNames(viewer, DEFERRED_TOOL_GROUPS));
	});
});
