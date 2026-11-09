import type { AssetWithCapabilities, Repository } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { getPublicationStatusOptions } from "@/lib/labels/publication-status";
import { m } from "@/paraglide/messages";
import { RepositoryFieldGroup } from "./repository-field-group";
import { repositoryFormOptions } from "./repository-form-options";

const RepositoryForm = ({
	action,
	block,
	assets,
}: {
	action: "create" | "update";
	block?: Repository;
	assets?: AssetWithCapabilities[];
}) => {
	const { mutateAsync: createBlock } = useCreateBlockMutation();
	const navigate = useNavigate();
	const { mutateAsync: updateBlock } = useUpdateBlockMutation();
	const [selectedAssets, setSelectedAssets] = useState<AssetWithCapabilities[]>(
		assets ?? [],
	);

	const form = useAppForm({
		...repositoryFormOptions(
			block,
			assets?.map((asset) => asset.id),
		),
		onSubmit: async ({ value }) => {
			const result =
				action === "update" && block
					? await updateBlock({
							...value,
							id: block.id,
						})
					: await createBlock(value);
			if (result.status === "success") {
				await navigate({
					to: "/app/library/$kind/$blockId",
					params: {
						kind: result.data.data.type,
						blockId: result.data.data.id,
					},
					ignoreBlocker: true,
				});
			}
		},
	});
	useUnsavedChangesGuard(() => !form.state.isDefaultValue);
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
			noValidate
		>
			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<form.AppField
				name="status"
				children={(field) => (
					<field.SelectField
						label={m.blocks_publication_status_label()}
						description={m.blocks_publication_status_description()}
						options={getPublicationStatusOptions()}
					/>
				)}
			/>

			<RepositoryFieldGroup
				form={form}
				fields={{
					name: "name",
					description: "description",
					contentJson: "contentJson",
					config: "config",
				}}
				assets={selectedAssets}
				onAssetsChange={(nextAssets) => {
					setSelectedAssets(nextAssets);
					form.setFieldValue(
						"assets",
						nextAssets.map((asset) => asset.id),
					);
				}}
				onUploadRun={(runId) =>
					form.setFieldValue("uploadRunIds", (runIds = []) => [
						...runIds,
						runId,
					])
				}
				blockId={block?.id}
			/>

			<form.AppForm>
				<form.SubmitButton
					label={
						action === "create"
							? m.blocks_repository_form_create_submit_button()
							: m.blocks_repository_form_update_submit_button()
					}
				/>
			</form.AppForm>
		</form>
	);
};

export { RepositoryForm };
