import {
	getProviderEndpointMode,
	getProviderPurpose,
	providerKinds,
	providerMeteringModes,
} from "@orcai/core";
import type { Provider } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useAppForm } from "@/hooks/form";
import {
	useCreateProviderMutation,
	useUpdateProviderMutation,
} from "@/hooks/mutations/use-provider-mutations";
import { getProviderKindLabel } from "@/lib/presentation/provider-kind";
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
			const { apiKey, kind, ...fields } = value;
			const endpoint =
				getProviderEndpointMode(kind) === "none"
					? null
					: fields.endpoint || null;
			if (action === "update" && provider) {
				await updateProvider({
					...fields,
					endpoint,
					apiKey: apiKey.trim() || undefined,
					id: provider.id,
				});
			} else {
				await createProvider({
					...fields,
					kind,
					endpoint,
					apiKey,
				});
			}
		},
	});
	const endpointMode = useSelector(form.store, (state) =>
		getProviderEndpointMode(state.values.kind),
	);
	const purpose = useSelector(form.store, (state) =>
		getProviderPurpose(state.values.kind),
	);

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
					name="kind"
					listeners={{
						onChange: ({ value }) => {
							form.setFieldValue("endpoint", "");
							if (getProviderPurpose(value) === "search") {
								form.setFieldValue("meteringMode", "requests");
							}
						},
					}}
					children={(field) => (
						<field.SelectField
							label={m.providers_form_kind_label()}
							placeholder={m.providers_form_kind_placeholder()}
							description={
								action === "update"
									? m.providers_form_kind_edit_description()
									: m.providers_form_kind_description()
							}
							options={providerKinds.map(({ kind }) => ({
								value: kind,
								label: getProviderKindLabel(kind),
							}))}
							disabled={action === "update"}
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

			{endpointMode === "none" ? (
				<p className="text-muted-foreground text-sm">
					{m.providers_form_endpoint_default_hint()}
				</p>
			) : (
				<form.AppField
					name="endpoint"
					children={(field) => (
						<field.TextField
							label={m.providers_form_endpoint_label()}
							description={
								endpointMode === "required"
									? m.providers_form_endpoint_description()
									: m.providers_form_endpoint_optional_description()
							}
							placeholder={
								endpointMode === "required"
									? "https://api.example.com/v1"
									: "https://api.tavily.com"
							}
						/>
					)}
				/>
			)}
			{purpose === "search" && (
				<p className="text-muted-foreground text-sm">
					{m.providers_form_search_kind_hint()}
				</p>
			)}

			<form.AppField
				name="apiKey"
				children={(field) => (
					<field.PasswordField
						label={
							action === "update"
								? m.providers_form_api_key_edit_label()
								: m.providers_form_api_key_label()
						}
						description={
							action === "update"
								? m.providers_form_api_key_edit_description()
								: m.providers_form_api_key_description()
						}
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
							description={
								purpose === "search"
									? m.providers_form_metering_mode_search_description()
									: m.providers_form_metering_mode_description()
							}
							options={providerMeteringModes.map((mode) => ({
								value: mode.value,
								label: mode.label,
							}))}
							disabled={purpose === "search"}
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
