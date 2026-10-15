import type { Asset, DatabaseBlock } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useState } from "react";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
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
	assets?: Asset[];
}) => {
	const { mutateAsync: createBlock } = useCreateBlockMutation();
	const navigate = useNavigate();
	const { mutateAsync: updateBlock } = useUpdateBlockMutation({
		onSuccess: (result) =>
			navigate({
				to: "/app/hub/blocks/$blockId",
				params: {
					blockId: result.data.id,
				},
			}),
	});
	const [selectedAssets, setSelectedAssets] = useState<Asset[]>(assets ?? []);

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
