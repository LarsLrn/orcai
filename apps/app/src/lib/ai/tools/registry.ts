import { type LucideIcon, WrenchIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { findPeople } from "./assistant/access/find-people.declaration";
import { grantAccess } from "./assistant/access/grant-access.declaration";
import { listAccess } from "./assistant/access/list-access.declaration";
import { revokeAccess } from "./assistant/access/revoke-access.declaration";
import { deleteAsset } from "./assistant/assets/delete-asset.declaration";
import { findAssets } from "./assistant/assets/find-assets.declaration";
import { generateAssetMetadata } from "./assistant/assets/generate-asset-metadata.declaration";
import { prepareAssetAgain } from "./assistant/assets/prepare-asset-again.declaration";
import { requestUpload } from "./assistant/assets/request-upload.declaration";
import { updateAsset } from "./assistant/assets/update-asset.declaration";
import { createBehaviour } from "./assistant/blocks/create-behaviour.declaration";
import { createRepository } from "./assistant/blocks/create-repository.declaration";
import { deleteBlock } from "./assistant/blocks/delete-block.declaration";
import { findBlocks } from "./assistant/blocks/find-blocks.declaration";
import { getBlock } from "./assistant/blocks/get-block.declaration";
import { updateBehaviour } from "./assistant/blocks/update-behaviour.declaration";
import { updateRepository } from "./assistant/blocks/update-repository.declaration";
import { createBot } from "./assistant/bots/create-bot.declaration";
import { deleteBot } from "./assistant/bots/delete-bot.declaration";
import { findBots } from "./assistant/bots/find-bots.declaration";
import { findModels } from "./assistant/bots/find-models.declaration";
import { getBot } from "./assistant/bots/get-bot.declaration";
import { publishBot } from "./assistant/bots/publish-bot.declaration";
import { updateBot } from "./assistant/bots/update-bot.declaration";
import { updateBotSetup } from "./assistant/bots/update-bot-setup.declaration";
import { addFromCatalogue } from "./assistant/catalogue/add-from-catalogue.declaration";
import { findCatalogue } from "./assistant/catalogue/find-catalogue.declaration";
import { removeFromOrganisation } from "./assistant/catalogue/remove-from-organisation.declaration";
import { addGroupMembers } from "./assistant/groups/add-group-members.declaration";
import { createGroup } from "./assistant/groups/create-group.declaration";
import { deleteGroup } from "./assistant/groups/delete-group.declaration";
import { listGroupMembers } from "./assistant/groups/list-group-members.declaration";
import { listGroups } from "./assistant/groups/list-groups.declaration";
import { removeGroupMembers } from "./assistant/groups/remove-group-members.declaration";
import { updateGroup } from "./assistant/groups/update-group.declaration";
import { loadTools } from "./assistant/load-tools.declaration";
import { cancelInvitation } from "./assistant/members/cancel-invitation.declaration";
import { changeMemberRole } from "./assistant/members/change-member-role.declaration";
import { inviteMembers } from "./assistant/members/invite-members.declaration";
import { listInvitations } from "./assistant/members/list-invitations.declaration";
import { listMembers } from "./assistant/members/list-members.declaration";
import { removeMembers } from "./assistant/members/remove-members.declaration";
import { updatePlan } from "./assistant/plan/update-plan.declaration";
import type {
	AssistantToolGroup,
	NameOf,
	ToolCall,
	ToolDeclaration,
	ToolKind,
	WrittenResource,
} from "./declaration";
import { readDocs } from "./docs/read-docs.declaration";
import type { EntityRef } from "./entity-kind";
import { displayTools } from "./gen-ui/display.declaration";
import { askUser } from "./questions/ask-user.declaration";
import { getAssetPage } from "./retrieval/get-asset-page.declaration";
import { getPassages } from "./retrieval/get-passages.declaration";
import { listRepositoryAssets } from "./retrieval/list-repository-assets.declaration";
import { searchRepositories } from "./retrieval/search-repositories.declaration";
import { nativeWebSearch } from "./web-search/native-web-search.declaration";
import { searchWeb } from "./web-search/search-web.declaration";

/** Every tool of plain and assistant chats; the assistant offers its own in this order. */
const toolDeclarations = {
	searchRepositories,
	listRepositoryAssets,
	getAssetPage,
	getPassages,
	searchWeb,
	web_search: nativeWebSearch,
	readDocs,
	askUser,
	...displayTools,
	findBots,
	getBot,
	getBlock,
	findBlocks,
	findAssets,
	listGroups,
	listMembers,
	loadTools,
	updatePlan,
	findModels,
	findCatalogue,
	createBot,
	updateBot,
	updateBotSetup,
	publishBot,
	deleteBot,
	createBehaviour,
	updateBehaviour,
	createRepository,
	updateRepository,
	deleteBlock,
	updateAsset,
	deleteAsset,
	prepareAssetAgain,
	generateAssetMetadata,
	requestUpload,
	addFromCatalogue,
	removeFromOrganisation,
	listAccess,
	findPeople,
	grantAccess,
	revokeAccess,
	createGroup,
	updateGroup,
	deleteGroup,
	addGroupMembers,
	removeGroupMembers,
	listGroupMembers,
	changeMemberRole,
	removeMembers,
	inviteMembers,
	listInvitations,
	cancelInvitation,
};

type Declarations = typeof toolDeclarations;

export type ToolName = keyof Declarations;

export type ToolNameOf<Kind extends ToolKind> = {
	[Name in ToolName]: Declarations[Name]["kind"] extends Kind ? Name : never;
}[ToolName];

export type AssistantToolName = {
	[Name in ToolName]: Declarations[Name] extends {
		group: AssistantToolGroup;
	}
		? Name
		: never;
}[ToolName];

export type ClientToolName = ToolNameOf<"client">;

const registry: Readonly<Record<string, ToolDeclaration>> = toolDeclarations;

/** Every declared tool, in registry order. */
export const toolEntries = Object.entries(registry) as [
	ToolName,
	ToolDeclaration,
][];

export const toolNamesOf = <Kind extends ToolKind>(kind: Kind) =>
	toolEntries
		.filter(([, declaration]) => declaration.kind === kind)
		.map(([name]) => name as ToolNameOf<Kind>);

export const toolDeclarationOf = (
	toolName: string,
): ToolDeclaration | undefined =>
	Object.hasOwn(registry, toolName) ? registry[toolName] : undefined;

/** The declaration of a part's tool; none for dynamic tools and tools no longer declared. */
const partDeclaration = (part: { type: string }) =>
	part.type.startsWith("tool-")
		? toolDeclarationOf(part.type.slice("tool-".length))
		: undefined;

/** The tool name a part's type carries. */
export const toolNameOf = <
	Part extends {
		type: `tool-${string}`;
	},
>(
	part: Part,
) =>
	part.type.slice("tool-".length) as Part["type"] extends `tool-${infer Name}`
		? Name
		: never;

export const toolKindOf = (part: { type: string }): ToolKind | undefined =>
	partDeclaration(part)?.kind;

export const isToolOfKind = <
	Kind extends ToolKind,
	Part extends {
		type: string;
	},
>(
	part: Part,
	kind: Kind,
): part is Extract<
	Part,
	{
		type: `tool-${ToolNameOf<Kind>}`;
	}
> => toolKindOf(part) === kind;

export interface ToolLabels {
	/** Entry label before the input is complete, or when there is nothing else to say. */
	name: string;
	active: string;
	icon: LucideIcon;
}

/** Stored parts outlive the tool set, so unknown tools are named by their name. */
export const toolLabels = (part: {
	type: string;
	toolName?: string;
}): ToolLabels => {
	const declaration = partDeclaration(part);

	if (declaration) {
		return {
			name: declaration.name(),
			active: declaration.active(),
			icon: declaration.icon,
		};
	}

	const name = part.toolName ?? part.type.replace(/^tool-/, "");

	return {
		name,
		active: m.chat_work_log_tool_generic_active({
			tool: name,
		}),
		icon: WrenchIcon,
	};
};

export interface ToolSummary {
	/** The ids the line names. */
	refs: EntityRef[];
	/** Undefined when the call does not fit its tool, as a stored output of an older shape. */
	line: (nameOf: NameOf) => string | undefined;
}

/** How a call whose input is complete reads in one line; undefined for a tool without one. */
export const toolSummary = (
	toolName: string,
	call: ToolCall<unknown, unknown>,
): ToolSummary | undefined => {
	const declaration = toolDeclarationOf(toolName);
	const line = declaration?.line;

	if (!line) {
		return undefined;
	}

	const fits = <A>(read: () => A): A | undefined => {
		try {
			return read();
		} catch {
			return undefined;
		}
	};

	return {
		refs: fits(() => declaration.refs?.(call)) ?? [],
		line: (nameOf) => fits(() => line(call, nameOf)),
	};
};

/**
 * The tools whose calls are conversation content, the user's view of them in
 * the answer: display tools and conversational client tools.
 */
export const CONTENT_TOOL_NAMES: readonly ToolName[] = toolEntries
	.filter(
		([, declaration]) =>
			declaration.kind === "display" || declaration.conversational === true,
	)
	.map(([name]) => name);

export const isConversationalTool = (toolName: string) =>
	toolDeclarationOf(toolName)?.conversational === true;

/** A content call as markdown; undefined for other tools and calls that do not fit. */
export const toolCallMarkdown = (part: {
	type: string;
	input?: unknown;
	output?: unknown;
}): string | undefined => {
	try {
		return partDeclaration(part)?.markdown?.({
			input: part.input,
			output: part.output,
		});
	} catch {
		return undefined;
	}
};

/** The resource a finished call wrote; undefined for other calls and calls that do not fit. */
export const writtenResource = (part: {
	type: string;
	state?: string;
	output?: unknown;
}): WrittenResource | undefined => {
	const written = partDeclaration(part)?.written;

	if (!written || part.state !== "output-available") {
		return undefined;
	}
	try {
		return written(part.output);
	} catch {
		return undefined;
	}
};

/** What the browser answers a client call with; undefined for any other tool. */
export const clientOutputSchema = (toolName: string) => {
	const declaration = toolDeclarationOf(toolName);

	return declaration?.kind === "client" ? declaration.outputSchema : undefined;
};
