import { useAppForm } from "@/hooks/form";
import { providerCompatibilities } from "@/lib/ai/providers";
import type { Provider } from "@/lib/orpc/schemas/provider";
import { providerFormOptions } from "./provider-form-options";
import { useProviderFormSubmission } from "./use-provider-submission";

const ProviderForm = ({
	action,
	provider,
}: {
	action: "create" | "update";
	provider?: Provider;
}) => {
	const { create, update } = useProviderFormSubmission();

	const form = useAppForm({
		...providerFormOptions(provider),
		onSubmit: ({ value }) => {
			if (action === "update" && provider) {
				update({
					...value,
					id: provider.id,
				});
			} else {
				create(value);
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
				name="compatibility"
				children={(field) => (
					<field.SelectField
						label="Compatibility"
						placeholder="Provider compatibility"
						description="Select the compatibility type for this provider"
						options={providerCompatibilities.map((compatibility) => ({
							value: compatibility.value,
							label: compatibility.label,
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
						placeholder="Enter a name for this provider configuration"
					/>
				)}
			/>

			<form.AppField
				name="endpoint"
				children={(field) => (
					<field.TextField
						label="Endpoint"
						placeholder="Enter the endpoint for this provider configuration"
					/>
				)}
			/>

			<form.AppField
				name="apiKey"
				children={(field) => (
					<field.PasswordField
						label="API Key"
						placeholder="Enter your API key"
					/>
				)}
			/>

			<form.AppField
				name="enabled"
				children={(field) => (
					<field.SwitchField
						label="Enabled"
						description="Enable this provider for use in the organization"
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label="Save Provider" />
			</form.AppForm>
		</form>
	);
};

export { ProviderForm };
