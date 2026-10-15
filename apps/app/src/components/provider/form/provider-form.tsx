import { providerCompatibilities, providerMeteringModes } from "@orcai/core";
import type { Provider } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useAppForm } from "@/hooks/form";
import {
	useCreateProviderMutation,
	useUpdateProviderMutation,
} from "@/hooks/mutations/use-provider-mutations";
import { m } from "@/paraglide/messages";
import { providerFormOptions } from "./provider-form-options";

const ProviderForm = ({
	action,
	provider,
}: {
	action: "create" | "update";
	provider?: Provider;
}) => {
	const { mutateAsync: createProvider } = useCreateProviderMutation();
	const navigate = useNavigate();
	const { mutateAsync: updateProvider } = useUpdateProviderMutation({
		onSuccess: (result) =>
			navigate({
				to: "/app/providers/$providerId",
				params: {
					providerId: result.data.id,
				},
			}),
	});

	const form = useAppForm({
		...providerFormOptions(provider),
		onSubmit: async ({ value }) => {
			if (action === "update" && provider) {
				await updateProvider({
					...value,
					id: provider.id,
				});
			} else {
				await createProvider(value);
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
							label={m.providers_form_compatibility_label()}
							placeholder={m.providers_form_compatibility_placeholder()}
							description={m.providers_form_compatibility_description()}
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
							label={m.common_name_label()}
							description={m.providers_form_name_description()}
							placeholder={m.providers_form_name_placeholder()}
						/>
					)}
				/>
			</div>

			<form.AppField
				name="endpoint"
				children={(field) => (
					<field.TextField
						label={m.providers_form_endpoint_label()}
						description={m.providers_form_endpoint_description()}
						placeholder="https://api.openai.com/v1"
					/>
				)}
			/>

			<form.AppField
				name="apiKey"
				children={(field) => (
					<field.PasswordField
						label={m.providers_form_api_key_label()}
						description={m.providers_form_api_key_description()}
						placeholder={m.providers_form_api_key_placeholder()}
					/>
				)}
			/>

			<div className="grid gap-4 md:grid-cols-2">
				<form.AppField
					name="meteringMode"
					children={(field) => (
						<field.SelectField
							label={m.providers_form_metering_mode_label()}
							description={m.providers_form_metering_mode_description()}
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
							label={m.common_status_enabled_label()}
							description={m.providers_form_enabled_description()}
						/>
					)}
				/>
			</div>

			<form.AppForm>
				<form.SubmitButton label={m.providers_form_save_button()} />
			</form.AppForm>
		</form>
	);
};

export { ProviderForm };
