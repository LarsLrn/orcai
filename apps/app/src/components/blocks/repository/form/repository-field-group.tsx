import type { ActivityRunId, BlockId } from "@orcai/core";
import type { AssetWithCapabilities, RetrievalMode } from "@orcai/schema";
import { RepositoryEditor } from "@/components/authoring/repository-editor";
import { withFieldGroup } from "@/hooks/form";
import { m } from "@/paraglide/messages";

const repositoryGroupDefaultValues = {
	name: "",
	description: "",
	contentJson: null as unknown,
	minPassages: 1,
	defaultPassages: 4,
	maxPassages: 8,
	candidateLimit: 40 as number | undefined,
	maxPerAsset: 6 as number | undefined,
	scoreThreshold: 0.2 as number | undefined,
	retrievalMode: "hybrid" as RetrievalMode | undefined,
};

const repositoryTopLevelFieldMap = {
	name: "name",
	description: "description",
	contentJson: "contentJson",
	minPassages: "config.minPassages",
	defaultPassages: "config.defaultPassages",
	maxPassages: "config.maxPassages",
	candidateLimit: "config.candidateLimit",
	maxPerAsset: "config.maxPerAsset",
	scoreThreshold: "config.scoreThreshold",
	retrievalMode: "config.retrievalMode",
} as const;

const createRepositoryBuilderFieldMap = (index: number) =>
	({
		name: `repositories[${index}].name`,
		description: `repositories[${index}].description`,
		contentJson: `repositories[${index}].contentJson`,
		minPassages: `repositories[${index}].config.minPassages`,
		defaultPassages: `repositories[${index}].config.defaultPassages`,
		maxPassages: `repositories[${index}].config.maxPassages`,
		candidateLimit: `repositories[${index}].config.candidateLimit`,
		maxPerAsset: `repositories[${index}].config.maxPerAsset`,
		scoreThreshold: `repositories[${index}].config.scoreThreshold`,
		retrievalMode: `repositories[${index}].config.retrievalMode`,
	}) as const;

const RepositoryFieldGroup = withFieldGroup({
	defaultValues: repositoryGroupDefaultValues,
	props: {
		assetIds: [] as string[],
		onAssetIdsChange: (_ids: string[]) => {
			void _ids;
		},
		assets: [] as AssetWithCapabilities[],
		onAssetsChange: (_assets: AssetWithCapabilities[]) => {
			void _assets;
		},
		onUploadRun: (_runId: ActivityRunId) => {
			void _runId;
		},
		onRemove: undefined as (() => void) | undefined,
		blockId: undefined as BlockId | undefined,
	},
	render: function Render({
		group,
		assetIds,
		onAssetIdsChange,
		assets,
		onAssetsChange,
		onUploadRun,
		onRemove,
		blockId,
	}) {
		return (
			<RepositoryEditor
				blockId={blockId}
				onUploadRun={onUploadRun}
				nameField={
					<group.AppField
						name="name"
						children={(field) => (
							<field.TextField
								label={m.common_name_label()}
								placeholder={m.blocks_repository_form_name_placeholder()}
							/>
						)}
					/>
				}
				descriptionField={
					<group.AppField
						name="description"
						children={(field) => (
							<field.TextareaField
								label={m.blocks_repository_form_description_label()}
								placeholder={m.blocks_repository_form_description_placeholder()}
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
								label={m.blocks_repository_form_content_label()}
							/>
						)}
					/>
				}
				minPassagesField={
					<group.AppField
						name="minPassages"
						children={(field) => (
							<field.TextField
								label={m.blocks_repository_form_min_passages_label()}
								type="number"
							/>
						)}
					/>
				}
				defaultPassagesField={
					<group.AppField
						name="defaultPassages"
						children={(field) => (
							<field.TextField
								label={m.blocks_repository_form_default_passages_label()}
								type="number"
							/>
						)}
					/>
				}
				maxPassagesField={
					<group.AppField
						name="maxPassages"
						children={(field) => (
							<field.TextField
								label={m.blocks_repository_form_max_passages_label()}
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
								label={m.blocks_repository_form_candidate_limit_label()}
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
								label={m.blocks_repository_form_per_asset_label()}
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
								label={m.blocks_repository_form_score_threshold_label()}
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
								label={m.blocks_repository_form_retrieval_mode_label()}
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
	createRepositoryBuilderFieldMap,
	RepositoryFieldGroup,
	repositoryTopLevelFieldMap,
};
