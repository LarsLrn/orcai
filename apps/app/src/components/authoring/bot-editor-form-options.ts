import type { ActivityRunId, BlockId, BotId } from "@orcai/core";
import {
	type AssetWithCapabilities,
	type BotEditor,
	type DatabaseBlock,
	DEFAULT_FEATURES,
	type EntityCapabilities,
	type FeatureId,
	type Features,
	type PublicationStatus,
	type TemplateBlock,
} from "@orcai/schema";
import { createDefaultDatabaseBlock } from "@/components/authoring/database-block-editor";
import { createDefaultTemplateBlock } from "@/components/authoring/template-block-editor";
import { emptyCapabilities } from "@/lib/authz/capabilities";

type BotEditorTemplateBlock = {
	id?: BlockId;
	capabilities: EntityCapabilities<"block">;
	name: string;
	description: string;
	contentJson: unknown;
	type: "template";
	status: PublicationStatus;
	config: TemplateBlock["config"];
};

type BotEditorDatabaseBlock = {
	id?: BlockId;
	capabilities: EntityCapabilities<"block">;
	name: string;
	description: string;
	contentJson: unknown;
	type: "database";
	status: PublicationStatus;
	config: DatabaseBlock["config"];
	assetIds: string[];
	assets: AssetWithCapabilities[];
	/** Uploads in this editor whose assets the save indexes as part of their run. */
	uploadRunIds: ActivityRunId[];
};

// zod infers `Record<string, never>` for empty settings, which TanStack Form's
// DeepKeys collapses to never, dropping the `features` field name.
type BotEditorFeatures = {
	[Id in FeatureId]?: NonNullable<Features[Id]> extends Record<string, never>
		? Record<never, never>
		: Features[Id];
};

export type BotEditorFormValues = {
	id?: BotId;
	name: string;
	description: string;
	contentJson: unknown;
	status: PublicationStatus;
	capabilities: EntityCapabilities<"bot">;
	templateBlock: BotEditorTemplateBlock | null;
	databaseBlocks: BotEditorDatabaseBlock[];
	features: BotEditorFeatures;
};

const toBotEditorFormValues = (editor?: BotEditor): BotEditorFormValues => ({
	id: editor?.id,
	name: editor?.name ?? "",
	description: editor?.description ?? "",
	contentJson: editor?.contentJson ?? {},
	status: editor?.status ?? "draft",
	capabilities: editor?.capabilities ?? {
		...emptyCapabilities("bot"),
		read: true,
		use: true,
		edit: true,
		delete: true,
		manage_access: true,
	},
	templateBlock: editor?.templateBlock
		? {
				...editor.templateBlock,
				description: editor.templateBlock.description ?? "",
				contentJson: editor.templateBlock.contentJson ?? null,
			}
		: null,
	databaseBlocks:
		editor?.databaseBlocks.map((databaseBlock) => ({
			...databaseBlock,
			description: databaseBlock.description ?? "",
			contentJson: databaseBlock.contentJson ?? null,
			assetIds: databaseBlock.assetIds ?? [],
			uploadRunIds: [],
		})) ?? [],
	features: editor ? editor.features : DEFAULT_FEATURES,
});

export { toBotEditorFormValues };

export const createDefaultBuilderDatabaseBlock = (params?: {
	botName: string;
}): BotEditorFormValues["databaseBlocks"][number] => {
	const block = createDefaultDatabaseBlock(params);

	return {
		...block,
		description: block.description ?? "",
		contentJson: block.contentJson ?? null,
		assetIds: block.assetIds ?? [],
		uploadRunIds: [],
		capabilities: {
			...emptyCapabilities("block"),
			edit: true,
			read: true,
			use: true,
		},
	};
};

export const createDefaultBuilderTemplateBlock = (): NonNullable<
	BotEditorFormValues["templateBlock"]
> => {
	const block = createDefaultTemplateBlock();

	return {
		...block,
		description: block.description ?? "",
		contentJson: block.contentJson ?? null,
		capabilities: {
			...emptyCapabilities("block"),
			edit: true,
			read: true,
			use: true,
		},
	};
};
