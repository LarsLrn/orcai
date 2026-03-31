import { DatabaseBlockEditor } from "@/components/authoring/database-block-editor";
import { withFieldGroup } from "@/hooks/form";
import type { Asset } from "@/lib/orpc/schemas/asset";

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
	retrievalMode: "hybrid" as "dense" | "hybrid" | undefined,
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
		assets: [] as Asset[],
		onAssetsChange: (_assets: Asset[]) => {
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
							<field.TextField label="Name" placeholder="Course handbook" />
						)}
					/>
				}
				descriptionField={
					<group.AppField
						name="description"
						children={(field) => (
							<field.TextareaField
								label="Short Description"
								placeholder="Describe what this content collection is used for."
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
								label="Detailed Description"
								htmlFieldName="contentHtml"
							/>
						)}
					/>
				}
				minReferencesField={
					<group.AppField
						name="minReferences"
						children={(field) => (
							<field.TextField label="Minimum References" type="number" />
						)}
					/>
				}
				defaultReferencesField={
					<group.AppField
						name="defaultReferences"
						children={(field) => (
							<field.TextField label="Default References" type="number" />
						)}
					/>
				}
				maxReferencesField={
					<group.AppField
						name="maxReferences"
						children={(field) => (
							<field.TextField label="Maximum References" type="number" />
						)}
					/>
				}
				candidateLimitField={
					<group.AppField
						name="candidateLimit"
						children={(field) => (
							<field.TextField label="Candidate Limit" type="number" />
						)}
					/>
				}
				maxPerAssetField={
					<group.AppField
						name="maxPerAsset"
						children={(field) => (
							<field.TextField label="Max Per Document" type="number" />
						)}
					/>
				}
				scoreThresholdField={
					<group.AppField
						name="scoreThreshold"
						children={(field) => (
							<field.TextField
								label="Score Threshold"
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
								label="Retrieval Mode"
								options={[
									{
										value: "hybrid",
										label: "Hybrid",
									},
									{
										value: "dense",
										label: "Dense",
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
