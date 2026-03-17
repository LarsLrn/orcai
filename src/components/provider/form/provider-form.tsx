import { useAppForm } from "@/hooks/form";
import {
	useCreateProviderMutation,
	useUpdateProviderMutation,
} from "@/hooks/mutations/use-provider-mutations";
import {
	providerCompatibilities,
	providerMeteringModes,
} from "@/lib/ai/providers";
import type { Provider } from "@/lib/orpc/schemas/provider";
import { providerFormOptions } from "./provider-form-options";

const ProviderForm = ({
	action,
	provider,
}: {
	action: "create" | "update";
	provider?: Provider;
}) => {
	const { mutate: createProvider } = useCreateProviderMutation();
	const { mutate: updateProvider } = useUpdateProviderMutation();

	const form = useAppForm({
		...providerFormOptions(provider),
		onSubmit: ({ value }) => {
			if (action === "update" && provider) {
				updateProvider({
					...value,
					id: provider.id,
				});
			} else {
				createProvider(value);
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
			<div className="grid gap-4 md:grid-cols-2">
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
							description="This will show for users"
							placeholder="Enter a name for this provider configuration"
						/>
					)}
				/>
			</div>

			<form.AppField
				name="endpoint"
				children={(field) => (
					<field.TextField
						label="Endpoint"
						description="Enter the full API endpoint URL for this provider (e.g. https://api.provider.com/v1)"
						placeholder="Enter the endpoint for this provider configuration"
					/>
				)}
			/>

			<form.AppField
				name="apiKey"
				children={(field) => (
					<field.PasswordField
						label="API Key"
						description="Your API key will be stored encrypted"
						placeholder="Enter your API key"
					/>
				)}
			/>

			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField
					name="meteringMode"
					children={(field) => (
						<field.SelectField
							label="Metering Mode"
							description="Defines how quota is enforced for this provider"
							options={providerMeteringModes.map((mode) => ({
								value: mode.value,
								label: mode.label,
							}))}
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
			</div>

			<form.AppForm>
				<form.SubmitButton label="Save Provider" />
			</form.AppForm>
		</form>
	);
};

export { ProviderForm };
