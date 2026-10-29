import type { AssetWithCapabilities, DatabaseBlock } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { getPublicationStatusOptions } from "@/lib/presentation/publication-status";
import { m } from "@/paraglide/messages";
import {
	DatabaseBlockFieldGroup,
	databaseBlockTopLevelFieldMap,
} from "./database-block-field-group";
import { databaseBlockFormOptions } from "./database-block-form-options";

const DatabaseBlockForm = ({
	action,
	block,
	assets,
}: {
	action: "create" | "update";
	block?: DatabaseBlock;
	assets?: AssetWithCapabilities[];
}) => {
	const { mutateAsync: createBlock } = useCreateBlockMutation();
	const navigate = useNavigate();
	const { mutateAsync: updateBlock } = useUpdateBlockMutation({
		onSuccess: (result) =>
			navigate({
				to: "/app/library/repositories/$blockId",
				params: {
					blockId: result.data.id,
				},
				ignoreBlocker: true,
			}),
	});
	const [selectedAssets, setSelectedAssets] = useState<AssetWithCapabilities[]>(
		assets ?? [],
	);

	const form = useAppForm({
		...databaseBlockFormOptions(
			block,
			assets?.map((asset) => asset.id),
		),
		onSubmit: async ({ value }) => {
			if (action === "update" && block) {
				await updateBlock({
					...value,
					id: block.id,
				});
				return;
			}

			await createBlock(value);
		},
	});
	useUnsavedChangesGuard(() => !form.state.isDefaultValue);

	const assetIds = useSelector(form.store, (state) => state.values.assets);
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

			<DatabaseBlockFieldGroup
				form={form}
				fields={databaseBlockTopLevelFieldMap}
				assetIds={assetIds ?? []}
				onAssetIdsChange={(ids) => form.setFieldValue("assets", ids)}
				assets={selectedAssets}
				onAssetsChange={setSelectedAssets}
				onRemove={undefined}
				blockId={block?.id}
			/>

			<form.AppForm>
				<form.SubmitButton
					label={
						action === "create"
							? m.blocks_database_form_create_submit_button()
							: m.blocks_database_form_update_submit_button()
					}
				/>
			</form.AppForm>
		</form>
	);
};

export { DatabaseBlockForm };
