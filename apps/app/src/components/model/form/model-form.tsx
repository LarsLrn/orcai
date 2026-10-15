import { modelCapabilities } from "@orcai/core";
import type { Model } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAppForm } from "@/hooks/form";
import {
	useCreateModelMutation,
	useUpdateModelMutation,
} from "@/hooks/mutations/use-model-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { modelFormOptions } from "./model-form-options";

const ModelForm = ({
	action,
	model,
}: {
	action: "create" | "update";
	model?: Model;
}) => {
	const { mutateAsync: createModel } = useCreateModelMutation();
	const navigate = useNavigate();
	const { mutateAsync: updateModel } = useUpdateModelMutation({
		onSuccess: (result) =>
			navigate({
				to: "/app/models/$modelId",
				params: {
					modelId: result.data.id,
				},
			}),
	});

	const providers = useQuery(
		orpc.provider.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 100,
			},
		}),
	);

	const form = useAppForm({
		...modelFormOptions(model),
		onSubmit: async ({ value }) => {
			if (action === "update" && model) {
				await updateModel({
					...value,
					id: model.id,
				});
			} else {
				await createModel(value);
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-4"
		>
			<form.AppField
				name="providerId"
				children={(field) => (
					<field.SelectField
						label={m.common_provider_label()}
						placeholder={m.models_form_provider_placeholder()}
						description={m.models_form_provider_description()}
						options={providers.data?.data?.map((provider) => ({
							value: provider.id,
							label: provider.name,
						}))}
						disabled={action === "update"} // Don't allow changing provider on edit
					/>
				)}
			/>

			<form.AppField
				name="name"
				children={(field) => (
					<field.TextField
						label={m.common_name_label()}
						placeholder={m.models_form_name_placeholder()}
					/>
				)}
			/>

			<form.AppField
				name="providerModelId"
				children={(field) => (
					<field.TextField
						label={m.models_form_provider_model_id_label()}
						placeholder={m.models_form_provider_model_id_placeholder()}
					/>
				)}
			/>

			<form.AppField
				name="description"
				children={(field) => (
					<field.TextareaField
						label={m.common_description_label()}
						placeholder={m.models_form_description_placeholder()}
					/>
				)}
			/>

			<form.AppField
				name="capabilities"
				children={(field) => (
					<field.MultiSelectField
						label={m.models_form_capabilities_label()}
						placeholder={m.models_form_capabilities_placeholder()}
						description={m.models_form_capabilities_description()}
						options={modelCapabilities.map((capability) => ({
							value: capability.value,
							label: capability.label,
						}))}
					/>
				)}
			/>

			<form.AppField
				name="isDeprecated"
				children={(field) => (
					<field.SwitchField
						label={m.common_status_deprecated_label()}
						description={m.models_form_deprecated_description()}
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label={m.models_form_save_button()} />
			</form.AppForm>
		</form>
	);
};

export { ModelForm };
