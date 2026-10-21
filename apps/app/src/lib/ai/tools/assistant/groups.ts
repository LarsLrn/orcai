import type { OrganizationCapability } from "@orcai/schema";

/** Every assistant tool by group. Core tools are always active; the others once `loadTools` loaded their group. */
export const ASSISTANT_TOOL_GROUPS = {
	core: [
		"readDocs",
		"showChecklist",
		"showReview",
		"showMatrix",
		"findBots",
		"getBot",
		"getBlock",
		"findBlocks",
		"findAssets",
		"listGroups",
		"listMembers",
		"loadTools",
		"updatePlan",
	],
	bots: [
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
	sharing: [
		"listAccess",
		"findPrincipals",
		"grantAccess",
		"revokeAccess",
	],
	people: [
		"createGroup",
		"updateGroup",
		"deleteGroup",
		"addGroupMembers",
		"removeGroupMembers",
		"listGroupMembers",
		"changeMemberRole",
		"removeMembers",
		"inviteMembers",
		"listInvitations",
		"cancelInvitation",
	],
} as const;

export type AssistantToolGroup = keyof typeof ASSISTANT_TOOL_GROUPS;
export type DeferredToolGroup = Exclude<AssistantToolGroup, "core">;
export type AssistantToolName =
	(typeof ASSISTANT_TOOL_GROUPS)[AssistantToolGroup][number];

/** What a tool does; create tools stay hidden until the user approved a plan. */
export type AssistantToolKind =
	| "read"
	| "display"
	| "plan"
	| "create"
	| "change"
	| "widget";

export const ASSISTANT_TOOL_KINDS = {
	readDocs: "read",
	showChecklist: "display",
	showReview: "display",
	showMatrix: "display",
	findBots: "read",
	getBot: "read",
	getBlock: "read",
	findBlocks: "read",
	findAssets: "read",
	listGroups: "read",
	listMembers: "read",
	loadTools: "read",
	updatePlan: "plan",
	createBot: "create",
	updateBot: "change",
	publishBot: "change",
	deleteBot: "change",
	createTemplate: "create",
	updateTemplate: "change",
	createRepository: "create",
	updateRepository: "change",
	deleteBlock: "change",
	updateAsset: "change",
	deleteAsset: "change",
	retryAsset: "change",
	requestUpload: "widget",
	listAccess: "read",
	findPrincipals: "read",
	grantAccess: "change",
	revokeAccess: "change",
	createGroup: "create",
	updateGroup: "change",
	deleteGroup: "change",
	addGroupMembers: "change",
	removeGroupMembers: "change",
	listGroupMembers: "read",
	changeMemberRole: "change",
	removeMembers: "change",
	inviteMembers: "change",
	listInvitations: "read",
	cancelInvitation: "change",
} as const satisfies Record<AssistantToolName, AssistantToolKind>;

export const DEFERRED_TOOL_GROUPS = [
	"bots",
	"sharing",
	"people",
] as const satisfies DeferredToolGroup[];

/** Every tool of the deferred groups. */
export const DEFERRED_TOOL_NAMES: ReadonlySet<string> = new Set(
	DEFERRED_TOOL_GROUPS.flatMap((group) => ASSISTANT_TOOL_GROUPS[group]),
);

export const isCreateTool = (name: string) =>
	Object.hasOwn(ASSISTANT_TOOL_KINDS, name) &&
	ASSISTANT_TOOL_KINDS[name as AssistantToolName] === "create";

const contentCapabilities: OrganizationCapability[] = [
	"create_bot",
	"create_block",
	"create_asset",
];

/** Any of these capabilities offers the tool; no entry means every role. */
const toolCapabilities: Partial<
	Record<AssistantToolName, OrganizationCapability[]>
> = {
	listMembers: [
		"manage_members",
	],
	...Object.fromEntries(
		ASSISTANT_TOOL_GROUPS.bots.map((name) => [
			name,
			contentCapabilities,
		]),
	),
	requestUpload: [
		"create_asset",
	],
	...Object.fromEntries(
		ASSISTANT_TOOL_GROUPS.sharing.map((name) => [
			name,
			[
				"create_bot",
			],
		]),
	),
	createGroup: [
		"manage_groups",
	],
	updateGroup: [
		"manage_groups",
	],
	deleteGroup: [
		"manage_groups",
	],
	addGroupMembers: [
		"manage_groups",
	],
	removeGroupMembers: [
		"manage_groups",
	],
	listGroupMembers: [
		"manage_groups",
	],
	changeMemberRole: [
		"manage_members",
	],
	removeMembers: [
		"manage_members",
	],
	inviteMembers: [
		"invite_members",
	],
	listInvitations: [
		"invite_members",
	],
	cancelInvitation: [
		"invite_members",
	],
};

export type CapabilitySet = Partial<Record<OrganizationCapability, boolean>>;

const isGrantedTool = (name: AssistantToolName, capabilities: CapabilitySet) =>
	toolCapabilities[name]?.some(
		(capability) => capabilities[capability] === true,
	) ?? true;

/** The deferred groups with at least one tool this user may use. */
export const offeredToolGroups = (
	capabilities: CapabilitySet,
): DeferredToolGroup[] =>
	DEFERRED_TOOL_GROUPS.filter((group) =>
		ASSISTANT_TOOL_GROUPS[group].some((name) =>
			isGrantedTool(name, capabilities),
		),
	);

/** `loadTools` is offered when there is a group to load. */
export const isToolOffered = (
	name: AssistantToolName,
	capabilities: CapabilitySet,
) =>
	name === "loadTools"
		? offeredToolGroups(capabilities).length > 0
		: isGrantedTool(name, capabilities);

/** The tools of `group` this user may use; empty when the group is not offered. */
export const offeredGroupTools = (
	group: DeferredToolGroup,
	capabilities: CapabilitySet,
): AssistantToolName[] =>
	ASSISTANT_TOOL_GROUPS[group].filter((name) =>
		isToolOffered(name, capabilities),
	);

/** Every tool this user may use, loaded or not, plan or not. */
export const offeredAssistantToolNames = (
	capabilities: CapabilitySet,
): AssistantToolName[] => [
	...ASSISTANT_TOOL_GROUPS.core.filter((name) =>
		isToolOffered(name, capabilities),
	),
	...DEFERRED_TOOL_GROUPS.flatMap((group) =>
		offeredGroupTools(group, capabilities),
	),
];
