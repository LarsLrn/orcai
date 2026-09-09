import { providerCompatibilities, providerMeteringModes } from "@orcai/core";
import type { Provider } from "@orcai/schema";
import { useAppForm } from "@/hooks/form";
import {
	useCreateProviderMutation,
	useUpdateProviderMutation,
} from "@/hooks/mutations/use-provider-mutations";
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
							description="Only OpenAI-compatible endpoints are supported at the moment."
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
							description="Shown to users wherever this provider is named."
							placeholder="e.g. University OpenAI endpoint"
						/>
					)}
				/>
			</div>

			<form.AppField
				name="endpoint"
				children={(field) => (
					<field.TextField
						label="Endpoint"
						description="The base URL of the OpenAI-compatible endpoint, including the version path."
						placeholder="https://api.openai.com/v1"
					/>
				)}
			/>

			<form.AppField
				name="apiKey"
				children={(field) => (
					<field.PasswordField
						label="API key"
						description="The key is stored encrypted."
						placeholder="Paste the key from the provider"
					/>
				)}
			/>

			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField
					name="meteringMode"
					children={(field) => (
						<field.SelectField
							label="Metering mode"
							description="Sets whether quota counts tokens or requests for this provider."
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
							description="When enabled, models from this provider can be used in this organisation."
						/>
					)}
				/>
			</div>

			<form.AppForm>
				<form.SubmitButton label="Save provider" />
			</form.AppForm>
		</form>
	);
};

export { ProviderForm };
