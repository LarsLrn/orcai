import {
	canReportCost,
	getProviderEndpointMode,
	getProviderPurpose,
	providerKinds,
	providerMeteringModes,
} from "@orcai/core";
import type { Provider } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { TriangleAlertIcon } from "lucide-react";
import {
	FormActions,
	FormPair,
	FormSection,
} from "@/components/forms/form-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAppForm } from "@/hooks/form";
import {
	useCreateProviderMutation,
	useUpdateProviderMutation,
} from "@/hooks/mutations/use-provider-mutations";
import { currencyOptions } from "@/lib/presentation/currency";
import { getMeteringModeLabel } from "@/lib/presentation/metering-mode";
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
			// An emptied price field is cleared, not left as it was.
			const searchPrice = fields.searchPrice ?? null;
			if (action === "update" && provider) {
				await updateProvider({
					...fields,
					endpoint,
					searchPrice,
					apiKey: apiKey.trim() || undefined,
					id: provider.id,
				});
			} else {
				await createProvider({
					...fields,
					kind,
					endpoint,
					searchPrice,
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
	const reportsCostOffered = useSelector(form.store, (state) =>
		canReportCost(state.values.kind),
	);
	const reportsCost = useSelector(
		form.store,
		(state) => state.values.reportsCost,
	);
	const currency = useSelector(form.store, (state) => state.values.currency);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-5"
		>
			<FormSection title={m.providers_form_connection_section_title()}>
				<form.AppField
					name="kind"
					listeners={{
						onChange: ({ value }) => {
							form.setFieldValue("endpoint", "");
							if (getProviderPurpose(value) === "search") {
								form.setFieldValue("meteringMode", "requests");
							} else {
								form.setFieldValue("searchPrice", null);
							}
							if (!canReportCost(value)) {
								form.setFieldValue("reportsCost", false);
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
				{purpose === "search" && (
					<p className="text-muted-foreground text-sm">
						{m.providers_form_search_kind_hint()}
					</p>
				)}

				<form.AppField
					name="name"
					children={(field) => (
						<field.TextField
							label={m.common_name_label()}
							description={m.providers_form_name_description()}
							placeholder={m.providers_form_name_placeholder()}
							width="medium"
						/>
					)}
				/>

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
								inputMode="url"
								className="font-mono"
							/>
						)}
					/>
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
							width="medium"
						/>
					)}
				/>
			</FormSection>

			<FormSection title={m.providers_form_usage_section_title()}>
				<FormPair>
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
									value: mode,
									label: getMeteringModeLabel(mode),
								}))}
								disabled={purpose === "search"}
							/>
						)}
					/>
					<form.AppField
						name="currency"
						children={(field) => (
							<field.SelectField
								label={m.providers_form_currency_label()}
								description={
									reportsCost
										? m.providers_form_currency_reported_description()
										: m.providers_form_currency_description()
								}
								options={currencyOptions()}
								disabled={reportsCost}
							/>
						)}
					/>
				</FormPair>
				{provider !== undefined && currency !== provider.currency && (
					<Alert>
						<TriangleAlertIcon />
						<AlertTitle>{m.providers_form_currency_changed_title()}</AlertTitle>
						<AlertDescription>
							{m.providers_form_currency_changed_description()}
						</AlertDescription>
					</Alert>
				)}
				{reportsCostOffered && (
					<form.AppField
						name="reportsCost"
						listeners={{
							onChange: ({ value }) => {
								if (value) {
									form.setFieldValue("currency", "USD");
								}
							},
						}}
						children={(field) => (
							<field.SwitchField
								label={m.providers_form_reports_cost_label()}
								description={m.providers_form_reports_cost_description()}
							/>
						)}
					/>
				)}
				{purpose === "search" && (
					<form.AppField
						name="searchPrice"
						children={(field) => (
							<field.TextField
								label={m.providers_form_search_price_label()}
								description={m.providers_form_search_price_description()}
								type="number"
								min={0}
								step="any"
								unit={currency}
							/>
						)}
					/>
				)}
			</FormSection>

			<FormSection title={m.forms_section_availability_title()}>
				<form.AppField
					name="enabled"
					children={(field) => (
						<field.SwitchField
							label={m.common_status_enabled_label()}
							description={m.providers_form_enabled_description()}
						/>
					)}
				/>
			</FormSection>

			<form.AppForm>
				<FormActions>
					<form.SubmitButton label={m.providers_form_save_button()} />
				</FormActions>
			</form.AppForm>
		</form>
	);
};

export { ProviderForm };
