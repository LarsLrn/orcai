import type { Asset, DatabaseBlock } from "@orcai/schema";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
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
	assets?: Asset[];
}) => {
	const { mutate: createBlock } = useCreateBlockMutation();
	const { mutate: updateBlock } = useUpdateBlockMutation();
	const [selectedAssets, setSelectedAssets] = useState<Asset[]>(assets ?? []);

	const form = useAppForm({
		...databaseBlockFormOptions(
			block,
			assets?.map((asset) => asset.id),
		),
		onSubmit: ({ value }) => {
			if (action === "update" && block) {
				updateBlock({
					...value,
					id: block.id,
				});
				return;
			}

			createBlock(value);
		},
	});
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
						options={[
							{
								value: "draft",
								label: m.blocks_publication_status_draft_option(),
							},
							{
								value: "ready",
								label: m.blocks_publication_status_ready_option(),
							},
						]}
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
