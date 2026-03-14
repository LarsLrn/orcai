import { useQuery } from "@tanstack/react-query";
import { useAppForm } from "@/hooks/form";
import {
	useCreateModelMutation,
	useUpdateModelMutation,
} from "@/hooks/mutations/use-model-mutations";
import { modelCapabilities } from "@/lib/ai/providers";
import { orpc } from "@/lib/orpc/orpc";
import type { Model } from "@/lib/orpc/schemas/model";
import { modelFormOptions } from "./model-form-options";

const ModelForm = ({
	action,
	model,
}: {
	action: "create" | "update";
	model?: Model;
}) => {
	const { mutate: createModel } = useCreateModelMutation();
	const { mutate: updateModel } = useUpdateModelMutation();

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
		onSubmit: ({ value }) => {
			if (action === "update" && model) {
				updateModel({
					...value,
					id: model.id,
				});
			} else {
				createModel(value);
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
						label="Provider"
						placeholder="Select a provider"
						description="Select the provider for this model"
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
						label="Name"
						placeholder="Enter a name for this model"
					/>
				)}
			/>

			<form.AppField
				name="providerModelId"
				children={(field) => (
					<field.TextField
						label="Provider Model ID"
						placeholder="Enter the provider model ID"
					/>
				)}
			/>

			<form.AppField
				name="capabilities"
				children={(field) => (
					<field.MultiSelectField
						label="Capabilities"
						placeholder="text, embeddings, etc."
						description="Select the capabilities for this model"
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
						label="Deprecated"
						description="Mark this model as deprecated. Deprecated models will not be available for new agent configurations, but existing agents using this model will continue to work."
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label="Save Model" />
			</form.AppForm>
		</form>
	);
};

export { ModelForm };
