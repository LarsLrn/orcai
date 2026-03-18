import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import type { TemplateBlock } from "@/lib/orpc/schemas/block";
import {
	TemplateBlockFieldGroup,
	templateBlockTopLevelFieldMap,
} from "./template-block-field-group";
import { templateBlockFormOptions } from "./template-block-form-options";

const TemplateBlockForm = ({
	action,
	block,
}: {
	action: "create" | "update";
	block?: TemplateBlock;
}) => {
	const { mutate: createBlock } = useCreateBlockMutation();
	const { mutate: updateBlock } = useUpdateBlockMutation();

	const form = useAppForm({
		...templateBlockFormOptions(block),
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

			<TemplateBlockFieldGroup
				form={form}
				fields={templateBlockTopLevelFieldMap}
			/>

			<form.AppForm>
				<form.SubmitButton
					label={
						action === "create" ? "Save AI Behavior" : "Update AI Behavior"
					}
				/>
			</form.AppForm>
		</form>
	);
};

export { TemplateBlockForm };
