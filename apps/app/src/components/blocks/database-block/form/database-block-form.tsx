import { useStore } from "@tanstack/react-form";
import { useState } from "react";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import type { Asset } from "@/lib/orpc/schemas/asset";
import type { DatabaseBlock } from "@/lib/orpc/schemas/block";
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
	const assetIds = useStore(form.store, (state) => state.values.assets);
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
						label="Publication Status"
						description="Control whether this resource is still in draft or ready to be used in published experiences."
						options={[
							{
								value: "draft",
								label: "Draft",
							},
							{
								value: "ready",
								label: "Ready",
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
							? "Save Content Collection"
							: "Update Content Collection"
					}
				/>
			</form.AppForm>
		</form>
	);
};

export { DatabaseBlockForm };
