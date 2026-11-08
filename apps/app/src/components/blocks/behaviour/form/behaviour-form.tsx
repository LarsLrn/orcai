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
import { BehaviourFieldGroup } from "./behaviour-field-group";
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
	const { mutateAsync: updateBlock } = useUpdateBlockMutation();

	const form = useAppForm({
		...behaviourFormOptions(block),
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

			<BehaviourFieldGroup
				form={form}
				fields={{
					name: "name",
					description: "description",
					contentJson: "contentJson",
					config: "config",
				}}
			/>

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
