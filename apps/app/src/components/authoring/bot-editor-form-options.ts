import type { BlockId, BotId } from "@orcai/core";
import type {
	Asset,
	BotEditor,
	DatabaseBlock,
	EntityCapabilities,
	PublicationStatus,
	TemplateBlock,
} from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { createDefaultDatabaseBlock } from "@/components/authoring/database-block-editor";
import { createDefaultTemplateBlock } from "@/components/authoring/template-block-editor";
import { emptyCapabilities } from "@/lib/authz/capabilities";

type BotEditorTemplateBlock = {
	id?: BlockId;
	capabilities: EntityCapabilities<"block">;
	name: string;
	description: string;
	contentJson: unknown;
	contentHtml: string;
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
	contentHtml: string;
	type: "database";
	status: PublicationStatus;
	config: DatabaseBlock["config"];
	assetIds: string[];
	assets: Asset[];
};

export type BotEditorFormValues = {
	id?: BotId;
	name: string;
	description: string;
	contentJson: unknown;
	contentHtml: string;
	status: PublicationStatus;
	capabilities: EntityCapabilities<"bot">;
	templateBlock: BotEditorTemplateBlock | null;
	databaseBlocks: BotEditorDatabaseBlock[];
};

const toBotEditorFormValues = (editor?: BotEditor): BotEditorFormValues => ({
	id: editor?.id,
	name: editor?.name ?? "",
	description: editor?.description ?? "",
	contentJson: editor?.contentJson ?? {},
	contentHtml: editor?.contentHtml ?? "",
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
				contentHtml: editor.templateBlock.contentHtml ?? "",
			}
		: null,
	databaseBlocks:
		editor?.databaseBlocks.map((databaseBlock) => ({
			...databaseBlock,
			description: databaseBlock.description ?? "",
			contentJson: databaseBlock.contentJson ?? null,
			contentHtml: databaseBlock.contentHtml ?? "",
			assetIds: databaseBlock.assetIds ?? [],
		})) ?? [],
});

export const botEditorFormOptions = (editor?: BotEditor) =>
	formOptions({
		defaultValues: toBotEditorFormValues(editor),
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
		contentHtml: block.contentHtml ?? "",
		assetIds: block.assetIds ?? [],
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
		contentHtml: block.contentHtml ?? "",
		capabilities: {
			...emptyCapabilities("block"),
			edit: true,
			read: true,
			use: true,
		},
	};
};
