import type { OrganizationCapability } from "@orcai/schema";
import type {
	AssistantToolGroup,
	ConfirmationVerb,
	ToolDeclaration,
} from "@/lib/ai/tools/declaration";
import { type AssistantToolName, toolEntries } from "@/lib/ai/tools/registry";

export type { AssistantToolGroup, AssistantToolName };
export type DeferredToolGroup = Exclude<AssistantToolGroup, "core">;

export const DEFERRED_TOOL_GROUPS = [
	"bots",
	"sharing",
	"people",
] as const satisfies DeferredToolGroup[];

const assistantTools = toolEntries.filter(
	(
		entry,
	): entry is [
		AssistantToolName,
		ToolDeclaration,
	] => entry[1].group !== undefined,
);

const declarations = new Map(assistantTools);

/** Every assistant tool, in registry order. */
export const ASSISTANT_TOOL_NAMES = assistantTools.map(([name]) => name);

const toolsOf = (group: AssistantToolGroup) =>
	assistantTools
		.filter(([, declaration]) => declaration.group === group)
		.map(([name]) => name);

/** Every assistant tool by group, in registry order. */
export const ASSISTANT_TOOL_GROUPS: Readonly<
	Record<AssistantToolGroup, readonly AssistantToolName[]>
> = {
	core: toolsOf("core"),
	bots: toolsOf("bots"),
	sharing: toolsOf("sharing"),
	people: toolsOf("people"),
};

/** Every tool of the deferred groups. */
export const DEFERRED_TOOL_NAMES: ReadonlySet<string> = new Set(
	DEFERRED_TOOL_GROUPS.flatMap((group) => ASSISTANT_TOOL_GROUPS[group]),
);

/** Create tools stay hidden until the user approved a plan. */
export const isCreateTool = (name: string) =>
	declarations.get(name as AssistantToolName)?.kind === "create";

/** The tools that pause for the user's confirmation, with their card's verb. */
export const CONFIRMED_TOOLS: ReadonlyMap<AssistantToolName, ConfirmationVerb> =
	new Map(
		assistantTools.flatMap(([name, { confirm }]) =>
			confirm
				? [
						[
							name,
							confirm,
						] as const,
					]
				: [],
		),
	);

export type CapabilitySet = Partial<Record<OrganizationCapability, boolean>>;

const isGrantedTool = (name: string, capabilities: CapabilitySet) =>
	declarations
		.get(name as AssistantToolName)
		?.capabilities?.some((capability) => capabilities[capability] === true) ??
	true;

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
export const isToolOffered = (name: string, capabilities: CapabilitySet) =>
	name === "loadTools"
		? offeredToolGroups(capabilities).length > 0
		: isGrantedTool(name, capabilities);

/** The tools of `group` this user may use; empty when the group is not offered. */
export const offeredGroupTools = (
	group: AssistantToolGroup,
	capabilities: CapabilitySet,
): AssistantToolName[] =>
	ASSISTANT_TOOL_GROUPS[group].filter((name) =>
		isToolOffered(name, capabilities),
	);

/** Every tool this user may use, loaded or not, plan or not. */
export const offeredAssistantToolNames = (
	capabilities: CapabilitySet,
): AssistantToolName[] => [
	...offeredGroupTools("core", capabilities),
	...DEFERRED_TOOL_GROUPS.flatMap((group) =>
		offeredGroupTools(group, capabilities),
	),
];
