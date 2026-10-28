import type { AssetWithCapabilities, RetrievalMode } from "@orcai/schema";
import { DatabaseBlockEditor } from "@/components/authoring/database-block-editor";
import { withFieldGroup } from "@/hooks/form";
import { m } from "@/paraglide/messages";

const databaseBlockGroupDefaultValues = {
	name: "",
	description: "",
	contentJson: null as unknown,
	contentHtml: "",
	minReferences: 1,
	defaultReferences: 4,
	maxReferences: 8,
	candidateLimit: 40 as number | undefined,
	maxPerAsset: 6 as number | undefined,
	scoreThreshold: 0.2 as number | undefined,
	retrievalMode: "hybrid" as RetrievalMode | undefined,
};

const databaseBlockTopLevelFieldMap = {
	name: "name",
	description: "description",
	contentJson: "contentJson",
	contentHtml: "contentHtml",
	minReferences: "config.minReferences",
	defaultReferences: "config.defaultReferences",
	maxReferences: "config.maxReferences",
	candidateLimit: "config.candidateLimit",
	maxPerAsset: "config.maxPerAsset",
	scoreThreshold: "config.scoreThreshold",
	retrievalMode: "config.retrievalMode",
} as const;

const createDatabaseBlockBuilderFieldMap = (index: number) =>
	({
		name: `databaseBlocks[${index}].name`,
		description: `databaseBlocks[${index}].description`,
		contentJson: `databaseBlocks[${index}].contentJson`,
		contentHtml: `databaseBlocks[${index}].contentHtml`,
		minReferences: `databaseBlocks[${index}].config.minReferences`,
		defaultReferences: `databaseBlocks[${index}].config.defaultReferences`,
		maxReferences: `databaseBlocks[${index}].config.maxReferences`,
		candidateLimit: `databaseBlocks[${index}].config.candidateLimit`,
		maxPerAsset: `databaseBlocks[${index}].config.maxPerAsset`,
		scoreThreshold: `databaseBlocks[${index}].config.scoreThreshold`,
		retrievalMode: `databaseBlocks[${index}].config.retrievalMode`,
	}) as const;

const DatabaseBlockFieldGroup = withFieldGroup({
	defaultValues: databaseBlockGroupDefaultValues,
	props: {
		assetIds: [] as string[],
		onAssetIdsChange: (_ids: string[]) => {
			void _ids;
		},
		assets: [] as AssetWithCapabilities[],
		onAssetsChange: (_assets: AssetWithCapabilities[]) => {
			void _assets;
		},
		onRemove: undefined as (() => void) | undefined,
	},
	render: function Render({
		group,
		assetIds,
		onAssetIdsChange,
		assets,
		onAssetsChange,
		onRemove,
	}) {
		return (
			<DatabaseBlockEditor
				nameField={
					<group.AppField
						name="name"
						children={(field) => (
							<field.TextField
								label={m.common_name_label()}
								placeholder={m.blocks_database_form_name_placeholder()}
							/>
						)}
					/>
				}
				descriptionField={
					<group.AppField
						name="description"
						children={(field) => (
							<field.TextareaField
								label={m.blocks_database_form_description_label()}
								placeholder={m.blocks_database_form_description_placeholder()}
								rows={4}
							/>
						)}
					/>
				}
				contentField={
					<group.AppField
						name="contentJson"
						children={(field) => (
							<field.BlockEditorField
								label={m.blocks_database_form_content_label()}
								htmlFieldName="contentHtml"
							/>
						)}
					/>
				}
				minReferencesField={
					<group.AppField
						name="minReferences"
						children={(field) => (
							<field.TextField
								label={m.blocks_database_form_min_references_label()}
								type="number"
							/>
						)}
					/>
				}
				defaultReferencesField={
					<group.AppField
						name="defaultReferences"
						children={(field) => (
							<field.TextField
								label={m.blocks_database_form_default_references_label()}
								type="number"
							/>
						)}
					/>
				}
				maxReferencesField={
					<group.AppField
						name="maxReferences"
						children={(field) => (
							<field.TextField
								label={m.blocks_database_form_max_references_label()}
								type="number"
							/>
						)}
					/>
				}
				candidateLimitField={
					<group.AppField
						name="candidateLimit"
						children={(field) => (
							<field.TextField
								label={m.blocks_database_form_candidate_limit_label()}
								type="number"
							/>
						)}
					/>
				}
				maxPerAssetField={
					<group.AppField
						name="maxPerAsset"
						children={(field) => (
							<field.TextField
								label={m.blocks_database_form_per_asset_label()}
								type="number"
							/>
						)}
					/>
				}
				scoreThresholdField={
					<group.AppField
						name="scoreThreshold"
						children={(field) => (
							<field.TextField
								label={m.blocks_database_form_score_threshold_label()}
								type="number"
								min={0}
								max={1}
								step={0.01}
							/>
						)}
					/>
				}
				retrievalModeField={
					<group.AppField
						name="retrievalMode"
						children={(field) => (
							<field.SelectField
								label={m.blocks_database_form_retrieval_mode_label()}
								options={[
									{
										value: "hybrid",
										label: m.blocks_retrieval_mode_hybrid_label(),
									},
									{
										value: "dense",
										label: m.blocks_retrieval_mode_dense_label(),
									},
									{
										value: "sparse",
										label: m.blocks_retrieval_mode_sparse_label(),
									},
								]}
							/>
						)}
					/>
				}
				assetIds={assetIds}
				onAssetIdsChange={onAssetIdsChange}
				assets={assets}
				onAssetsChange={onAssetsChange}
				onRemove={onRemove}
			/>
		);
	},
});

export {
	createDatabaseBlockBuilderFieldMap,
	DatabaseBlockFieldGroup,
	databaseBlockTopLevelFieldMap,
};
