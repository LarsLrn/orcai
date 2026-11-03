import type { ActivityRunId, BlockId, BotId } from "@orcai/core";
import {
	type AssetWithCapabilities,
	type Behaviour,
	type BlockWithCapabilities,
	type BotEditor,
	DEFAULT_FEATURES,
	defaultRepositoryConfig,
	type EntityCapabilities,
	type FeatureId,
	type Features,
	type PublicationStatus,
	type Repository,
} from "@orcai/schema";
import { formOptions } from "@tanstack/react-form";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { m } from "@/paraglide/messages";

export type BotEditorBehaviour = {
	id?: BlockId;
	capabilities: EntityCapabilities<"block">;
	name: string;
	description: string;
	contentJson: unknown;
	type: "behaviour";
	status: PublicationStatus;
	config: Behaviour["config"];
};

export type BotEditorRepository = {
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

const botEditorFormOptions = formOptions({
	defaultValues: toBotEditorFormValues(),
});

const newBlockCapabilities = () => ({
	...emptyCapabilities("block"),
	edit: true,
	read: true,
	use: true,
});

/** The behaviour the editor creates. */
const newBehaviourValues = (): BotEditorBehaviour => ({
	capabilities: newBlockCapabilities(),
	name: m.authoring_behaviour_default_name(),
	description: "",
	contentJson: null,
	type: "behaviour",
	status: "draft",
	config: {
		systemPrompt: "",
	},
});

/** The repository the editor creates for a bot named `botName`. */
const newRepositoryValues = (botName: string): BotEditorRepository => ({
	capabilities: newBlockCapabilities(),
	name: botName
		? m.authoring_repository_default_name_named({
				botName,
			})
		: m.authoring_repository_default_name(),
	description: "",
	contentJson: null,
	type: "repository",
	status: "draft",
	config: {
		...defaultRepositoryConfig,
	},
	assetIds: [],
	assets: [],
	uploadRunIds: [],
});

/** A library block as the editor links it. */
const toLinkedBlockValues = ({
	data: block,
	assets = [],
}: {
	data: BlockWithCapabilities;
	assets?: AssetWithCapabilities[];
}): (BotEditorBehaviour | BotEditorRepository) & {
	id: BlockId;
} => {
	const fields = {
		id: block.id,
		capabilities: block.capabilities,
		name: block.name,
		description: block.description ?? "",
		contentJson: block.contentJson,
		status: block.status,
	};
	return block.type === "behaviour"
		? {
				...fields,
				type: "behaviour",
				config: block.config,
			}
		: {
				...fields,
				type: "repository",
				config: block.config,
				assetIds: assets.map((asset) => asset.id),
				assets,
				uploadRunIds: [],
			};
};

export {
	botEditorFormOptions,
	newBehaviourValues,
	newRepositoryValues,
	toBotEditorFormValues,
	toLinkedBlockValues,
};
