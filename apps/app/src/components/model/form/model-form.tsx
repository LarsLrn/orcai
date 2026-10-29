import { hasNativeWebSearch, modelCapabilities } from "@orcai/core";
import type { Model, ModelPrices } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import {
	FormActions,
	FormPair,
	FormSection,
} from "@/components/forms/form-layout";
import { useAppForm } from "@/hooks/form";
import {
	useCreateModelMutation,
	useUpdateModelMutation,
} from "@/hooks/mutations/use-model-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { getModelCapabilityLabel } from "@/lib/presentation/model-capability";
import { m } from "@/paraglide/messages";
import { modelFormOptions } from "./model-form-options";

const clearedPrices = (prices: Partial<ModelPrices> = {}): ModelPrices => ({
	input: prices.input ?? null,
	cacheRead: prices.cacheRead ?? null,
	cacheWrite: prices.cacheWrite ?? null,
	output: prices.output ?? null,
	request: prices.request ?? null,
	webSearch: prices.webSearch ?? null,
});

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
				filters: {
					purpose: "models",
				},
			},
		}),
	);

	const form = useAppForm({
		...modelFormOptions(model),
		onSubmit: async ({ value }) => {
			// An emptied limit or price field is cleared, not left as it was.
			const values = {
				...value,
				contextWindow: value.contextWindow ?? null,
				maxOutputTokens: value.maxOutputTokens ?? null,
				prices: clearedPrices(value.prices),
			};
			if (action === "update" && model) {
				await updateModel({
					...values,
					id: model.id,
				});
			} else {
				await createModel(values);
			}
		},
	});

	const providerId = useSelector(
		form.store,
		(state) => state.values.providerId,
	);
	// The list may not hold the model's provider; its currency labels the prices.
	const { data: provider } = useQuery({
		...orpc.provider.find.queryOptions({
			input: {
				id: providerId,
			},
		}),
		enabled: providerId !== "",
		select: ({ data }) => data,
	});
	const currency = provider?.currency ?? "USD";
	const priceField = (name: keyof ModelPrices, label: string) => (
		<form.AppField
			name={`prices.${name}`}
			children={(field) => (
				<field.TextField
					label={label}
					type="number"
					min={0}
					step="any"
					unit={currency}
				/>
			)}
		/>
	);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-5"
		>
			<FormSection title={m.forms_section_general_title()}>
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
							width="medium"
						/>
					)}
				/>
				<form.AppField
					name="providerModelId"
					children={(field) => (
						<field.TextField
							label={m.models_form_provider_model_id_label()}
							placeholder={m.models_form_provider_model_id_placeholder()}
							width="medium"
							className="font-mono"
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
			</FormSection>

			<FormSection title={m.models_form_capabilities_section_title()}>
				<form.AppField
					name="capabilities"
					children={(field) => (
						<field.MultiSelectField
							label={m.models_form_capabilities_label()}
							placeholder={m.models_form_capabilities_placeholder()}
							description={m.models_form_capabilities_description()}
							options={modelCapabilities.map((capability) => ({
								value: capability,
								label: getModelCapabilityLabel(capability),
							}))}
						/>
					)}
				/>
				<FormPair>
					<form.AppField
						name="contextWindow"
						children={(field) => (
							<field.TextField
								label={m.models_form_context_window_label()}
								description={m.models_form_context_window_description()}
								placeholder={m.models_form_context_window_placeholder()}
								type="number"
								min={1}
								unit={m.models_form_token_limit_unit()}
							/>
						)}
					/>
					<form.AppField
						name="maxOutputTokens"
						children={(field) => (
							<field.TextField
								label={m.models_form_max_output_tokens_label()}
								description={m.models_form_max_output_tokens_description()}
								placeholder={m.models_form_max_output_tokens_placeholder()}
								type="number"
								min={1}
								unit={m.models_form_token_limit_unit()}
							/>
						)}
					/>
				</FormPair>
			</FormSection>

			<FormSection
				title={m.models_form_prices_title()}
				description={m.models_form_prices_description({
					currency,
				})}
			>
				<div className="grid gap-x-6 gap-y-4 sm:grid-cols-[repeat(auto-fill,11rem)]">
					{priceField("input", m.models_form_input_price_label())}
					{priceField("output", m.models_form_output_price_label())}
					{priceField("cacheRead", m.models_form_cache_read_price_label())}
					{priceField("cacheWrite", m.models_form_cache_write_price_label())}
					{priceField("request", m.models_form_request_price_label())}
					{provider !== undefined &&
						hasNativeWebSearch(provider.kind) &&
						priceField("webSearch", m.models_form_web_search_price_label())}
				</div>
			</FormSection>

			<FormSection title={m.forms_section_availability_title()}>
				<form.AppField
					name="isDeprecated"
					children={(field) => (
						<field.SwitchField
							label={m.common_status_deprecated_label()}
							description={m.models_form_deprecated_description()}
						/>
					)}
				/>
			</FormSection>

			<form.AppForm>
				<FormActions>
					<form.SubmitButton label={m.models_form_save_button()} />
				</FormActions>
			</form.AppForm>
		</form>
	);
};

export { ModelForm };
