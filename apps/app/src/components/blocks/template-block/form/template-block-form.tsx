import type { TemplateBlock } from "@orcai/schema";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import { getPublicationStatusOptions } from "@/lib/presentation/publication-status";
import { m } from "@/paraglide/messages";
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
	const { mutateAsync: createBlock } = useCreateBlockMutation();
	const { mutateAsync: updateBlock } = useUpdateBlockMutation();

	const form = useAppForm({
		...templateBlockFormOptions(block),
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

			<TemplateBlockFieldGroup
				form={form}
				fields={templateBlockTopLevelFieldMap}
			/>

			<form.AppForm>
				<form.SubmitButton
					label={
						action === "create"
							? m.blocks_template_form_create_submit_button()
							: m.blocks_template_form_update_submit_button()
					}
				/>
			</form.AppForm>
		</form>
	);
};

export { TemplateBlockForm };
