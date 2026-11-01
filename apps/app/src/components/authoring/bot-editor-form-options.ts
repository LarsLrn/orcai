import type { ActivityRunId, BlockId, BotId } from "@orcai/core";
import {
	type AssetWithCapabilities,
	type Behaviour,
	type BotEditor,
	DEFAULT_FEATURES,
	type EntityCapabilities,
	type FeatureId,
	type Features,
	type PublicationStatus,
	type Repository,
} from "@orcai/schema";
import { createDefaultBehaviour } from "@/components/authoring/behaviour-editor";
import { createDefaultRepository } from "@/components/authoring/repository-editor";
import { emptyCapabilities } from "@/lib/authz/capabilities";

type BotEditorBehaviour = {
	id?: BlockId;
	capabilities: EntityCapabilities<"block">;
	name: string;
	description: string;
	contentJson: unknown;
	type: "behaviour";
	status: PublicationStatus;
	config: Behaviour["config"];
};

type BotEditorRepository = {
	id?: BlockId;
	capabilities: EntityCapabilities<"block">;
	name: string;
	description: string;
	contentJson: unknown;
	type: "repository";
	status: PublicationStatus;
	config: Repository["config"];
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
	behaviour: BotEditorBehaviour | null;
	repositories: BotEditorRepository[];
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
	behaviour: editor?.behaviour
		? {
				...editor.behaviour,
				description: editor.behaviour.description ?? "",
				contentJson: editor.behaviour.contentJson ?? null,
			}
		: null,
	repositories:
		editor?.repositories.map((repository) => ({
			...repository,
			description: repository.description ?? "",
			contentJson: repository.contentJson ?? null,
			assetIds: repository.assetIds ?? [],
			uploadRunIds: [],
		})) ?? [],
	features: editor ? editor.features : DEFAULT_FEATURES,
});

export { toBotEditorFormValues };

export const createDefaultBuilderRepository = (params?: {
	botName: string;
}): BotEditorFormValues["repositories"][number] => {
	const block = createDefaultRepository(params);

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

export const createDefaultBuilderBehaviour = (): NonNullable<
	BotEditorFormValues["behaviour"]
> => {
	const block = createDefaultBehaviour();

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
