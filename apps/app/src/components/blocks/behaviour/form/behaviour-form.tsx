import type { Behaviour } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useAppForm } from "@/hooks/form";
import {
	useCreateBlockMutation,
	useUpdateBlockMutation,
} from "@/hooks/mutations/use-block-mutations";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { getPublicationStatusOptions } from "@/lib/presentation/publication-status";
import { m } from "@/paraglide/messages";
import {
	BehaviourFieldGroup,
	behaviourTopLevelFieldMap,
} from "./behaviour-field-group";
import { behaviourFormOptions } from "./behaviour-form-options";

const BehaviourForm = ({
	action,
	block,
}: {
	action: "create" | "update";
	block?: Behaviour;
}) => {
	const { mutateAsync: createBlock } = useCreateBlockMutation();
	const navigate = useNavigate();
	const { mutateAsync: updateBlock } = useUpdateBlockMutation({
		onSuccess: (result) =>
			navigate({
				to: "/app/library/behaviours/$blockId",
				params: {
					blockId: result.data.id,
				},
				ignoreBlocker: true,
			}),
	});

	const form = useAppForm({
		...behaviourFormOptions(block),
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

			<BehaviourFieldGroup form={form} fields={behaviourTopLevelFieldMap} />

			<form.AppForm>
				<form.SubmitButton
					label={
						action === "create"
							? m.blocks_behaviour_form_create_submit_button()
							: m.blocks_behaviour_form_update_submit_button()
					}
				/>
			</form.AppForm>
		</form>
	);
};

export { BehaviourForm };
