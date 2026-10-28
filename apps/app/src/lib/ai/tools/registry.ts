import { type LucideIcon, WrenchIcon } from "lucide-react";
import {
	type DisplayToolName,
	displayToolMarkdown,
	primitiveCatalog,
} from "@/components/chat/gen-ui/catalog";
import type { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { createBot } from "./assistant/bots/create-bot.declaration";
import { createRepository } from "./assistant/bots/create-repository.declaration";
import { createTemplate } from "./assistant/bots/create-template.declaration";
import { deleteAsset } from "./assistant/bots/delete-asset.declaration";
import { deleteBlock } from "./assistant/bots/delete-block.declaration";
import { deleteBot } from "./assistant/bots/delete-bot.declaration";
import { findModels } from "./assistant/bots/find-models.declaration";
import { publishBot } from "./assistant/bots/publish-bot.declaration";
import { requestUpload } from "./assistant/bots/request-upload.declaration";
import { retryAsset } from "./assistant/bots/retry-asset.declaration";
import { updateAsset } from "./assistant/bots/update-asset.declaration";
import { updateBot } from "./assistant/bots/update-bot.declaration";
import { updateRepository } from "./assistant/bots/update-repository.declaration";
import { updateTemplate } from "./assistant/bots/update-template.declaration";
import { findAssets } from "./assistant/core/find-assets.declaration";
import { findBlocks } from "./assistant/core/find-blocks.declaration";
import { findBots } from "./assistant/core/find-bots.declaration";
import { getBlock } from "./assistant/core/get-block.declaration";
import { getBot } from "./assistant/core/get-bot.declaration";
import { listGroups } from "./assistant/core/list-groups.declaration";
import { listMembers } from "./assistant/core/list-members.declaration";
import { loadTools } from "./assistant/core/load-tools.declaration";
import { addGroupMembers } from "./assistant/people/add-group-members.declaration";
import { cancelInvitation } from "./assistant/people/cancel-invitation.declaration";
import { changeMemberRole } from "./assistant/people/change-member-role.declaration";
import { createGroup } from "./assistant/people/create-group.declaration";
import { deleteGroup } from "./assistant/people/delete-group.declaration";
import { inviteMembers } from "./assistant/people/invite-members.declaration";
import { listGroupMembers } from "./assistant/people/list-group-members.declaration";
import { listInvitations } from "./assistant/people/list-invitations.declaration";
import { removeGroupMembers } from "./assistant/people/remove-group-members.declaration";
import { removeMembers } from "./assistant/people/remove-members.declaration";
import { updateGroup } from "./assistant/people/update-group.declaration";
import { updatePlan } from "./assistant/plan/update-plan.declaration";
import { findPrincipals } from "./assistant/sharing/find-principals.declaration";
import { grantAccess } from "./assistant/sharing/grant-access.declaration";
import { listAccess } from "./assistant/sharing/list-access.declaration";
import { revokeAccess } from "./assistant/sharing/revoke-access.declaration";
import type {
	AssistantToolGroup,
	NameOf,
	ToolCall,
	ToolDeclaration,
	ToolKind,
} from "./declaration";
import { readDocs } from "./docs/read-docs.declaration";
import type { EntityRef } from "./entity-kind";
import { askUser } from "./questions/ask-user.declaration";
import { getKnowledgeBaseChunks } from "./rag/get-knowledge-base-chunks.declaration";
import { getKnowledgeBasePage } from "./rag/get-knowledge-base-page.declaration";
import { listKnowledgeBaseDocuments } from "./rag/list-knowledge-base-documents.declaration";
import { searchKnowledgeBase } from "./rag/search-knowledge-base.declaration";
import { nativeWebSearch } from "./web/native-web-search.declaration";
import { searchWeb } from "./web/search-web.declaration";

const displayTools = Object.fromEntries(
	Object.entries(primitiveCatalog).map(
		([name, { icon, name: label, active }]) => [
			name,
			{
				kind: "display",
				group: "core",
				icon,
				name: label,
				active,
				markdown: ({ input, output }) =>
					displayToolMarkdown(name as DisplayToolName, input, output) ??
					undefined,
			},
		],
	),
) as Record<
	DisplayToolName,
	ToolDeclaration & {
		kind: "display";
		group: "core";
	}
>;

/** Every tool of plain and assistant chats; the assistant offers its own in this order. */
const toolDeclarations = {
	searchKnowledgeBase,
	listKnowledgeBaseDocuments,
	getKnowledgeBasePage,
	getKnowledgeBaseChunks,
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
	createBot,
	updateBot,
	publishBot,
	deleteBot,
	createTemplate,
	updateTemplate,
	createRepository,
	updateRepository,
	deleteBlock,
	updateAsset,
	deleteAsset,
	retryAsset,
	requestUpload,
	listAccess,
	findPrincipals,
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
	/** Undefined when the call does not fit its tool, as a stored call of an older shape. */
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

/** What the browser answers a client call with; undefined for any other tool. */
export const clientOutputSchema = (toolName: string) => {
	const declaration = toolDeclarationOf(toolName);

	return declaration?.kind === "client" ? declaration.outputSchema : undefined;
};

const writingKinds = new Set<ToolKind>([
	"create",
	"change",
	"client",
]);

/** The data a tool that writes may have changed. */
const PLATFORM_DATA = [
	"bot",
	"block",
	"asset",
	"resource",
	"group",
	"organizationMember",
	"organizationInvitation",
	"user",
	"authorization",
] as const satisfies (keyof typeof orpc)[];

/** The query namespaces a reply made stale: all platform data once a tool that writes ran. */
export const staleDataOf = (message: {
	parts: readonly {
		type: string;
		state?: string;
	}[];
}): readonly (typeof PLATFORM_DATA)[number][] =>
	message.parts.some((part) => {
		const declaration = partDeclaration(part);

		return (
			declaration !== undefined &&
			writingKinds.has(declaration.kind) &&
			!declaration.conversational &&
			part.state === "output-available"
		);
	})
		? PLATFORM_DATA
		: [];
