import { formOptions } from "@tanstack/react-form";
import { createDefaultDatabaseBlock } from "@/components/authoring/database-block-editor";
import { createDefaultTemplateBlock } from "@/components/authoring/template-block-editor";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { DatabaseBlock, TemplateBlock } from "@/lib/orpc/schemas/block";
import type { BotEditorSelect } from "@/lib/orpc/schemas/bot-editor";
import type { PublicationStatus } from "@/lib/orpc/schemas/fragments/publication-status";

type BotEditorTemplateBlock = {
	id?: string;
	canEdit: boolean;
	name: string;
	description: string;
	contentJson: unknown;
	contentHtml: string;
	type: "template";
	status: PublicationStatus;
	config: TemplateBlock["config"];
};

type BotEditorDatabaseBlock = {
	id?: string;
	canEdit: boolean;
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
	id?: string;
	name: string;
	description: string;
	contentJson: unknown;
	contentHtml: string;
	status: PublicationStatus;
	templateBlock: BotEditorTemplateBlock | null;
	databaseBlocks: BotEditorDatabaseBlock[];
};

const toBotEditorFormValues = (
	editor?: BotEditorSelect,
): BotEditorFormValues => ({
	id: editor?.id,
	name: editor?.name ?? "",
	description: editor?.description ?? "",
	contentJson: editor?.contentJson ?? {},
	contentHtml: editor?.contentHtml ?? "",
	status: editor?.status ?? "draft",
	templateBlock: editor?.templateBlock
		? {
				...editor.templateBlock,
				description: editor.templateBlock.description ?? "",
				contentJson: editor.templateBlock.contentJson ?? null,
				contentHtml: editor.templateBlock.contentHtml ?? "",
				canEdit: editor.templateBlock.canEdit ?? true,
			}
		: null,
	databaseBlocks:
		editor?.databaseBlocks.map((databaseBlock) => ({
			...databaseBlock,
			description: databaseBlock.description ?? "",
			contentJson: databaseBlock.contentJson ?? null,
			contentHtml: databaseBlock.contentHtml ?? "",
			assetIds: databaseBlock.assetIds ?? [],
			canEdit: databaseBlock.canEdit ?? true,
		})) ?? [],
});

export const botEditorFormOptions = (editor?: BotEditorSelect) =>
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
		canEdit: true,
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
		canEdit: true,
	};
};
