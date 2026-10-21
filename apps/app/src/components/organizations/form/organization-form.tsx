import type { ModelId } from "@orcai/core";
import {
	type ModelCapability,
	modelIdSchema,
	type Organization,
} from "@orcai/schema";
import { skipToken, useQuery } from "@tanstack/react-query";
import { TriangleAlertIcon } from "lucide-react";
import { useId } from "react";
import { ModelSelectorButton } from "@/components/chat/model-selector";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from "@/components/ui/field";
import { useAppForm } from "@/hooks/form";
import {
	useCreateOrganizationMutation,
	useUpdateOrganizationMutation,
} from "@/hooks/mutations/use-organization-mutations";
import {
	type ModelUnusableReason,
	type ModelUse,
	modelUnusableReason,
} from "@/lib/ai/turn/model-usability";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { organizationFormOptions } from "./organization-form-options";

type OrganizationFormProps = {
	onCompleted?: () => void;
} & (
	| {
			action: "create";
			organization?: never;
	  }
	| {
			action: "update";
			organization: Organization;
	  }
);

type ModelSetting<Use extends ModelUse> = {
	use: Use;
	label: () => string;
	description: () => string;
	unsetHint: () => string;
	unusable: Record<ModelUnusableReason<Use>, () => string>;
};

const assistantModelSetting: ModelSetting<"turn"> = {
	use: "turn",
	label: m.orgs_form_assistant_model_label,
	description: m.orgs_form_assistant_model_description,
	unsetHint: m.orgs_form_assistant_model_unset_hint,
	unusable: {
		PROVIDER_DISABLED: m.orgs_form_assistant_model_unusable_provider_disabled,
		MODEL_DEPRECATED: m.orgs_form_assistant_model_unusable_deprecated,
		MODEL_TOOLS_UNSUPPORTED:
			m.orgs_form_assistant_model_unusable_tools_unsupported,
	},
};

const utilityModelSetting: ModelSetting<"text"> = {
	use: "text",
	label: m.orgs_form_utility_model_label,
	description: m.orgs_form_utility_model_description,
	unsetHint: m.orgs_form_utility_model_unset_hint,
	unusable: {
		PROVIDER_DISABLED: m.orgs_form_utility_model_unusable_provider_disabled,
		MODEL_DEPRECATED: m.orgs_form_utility_model_unusable_deprecated,
		MODEL_TEXT_UNSUPPORTED: m.orgs_form_utility_model_unusable_text_unsupported,
	},
};

const pickerCapabilities: Record<ModelUse, ModelCapability[]> = {
	turn: [
		"text",
		"tool-calling",
	],
	text: [
		"text",
	],
};

/** A model picker for an organisation setting, limited to usable models, warning when the chosen one no longer is. */
const OrganizationModelField = <Use extends ModelUse>({
	setting,
	value,
	onChange,
}: {
	setting: ModelSetting<Use>;
	value: string | null;
	onChange: (modelId: string | null) => void;
}) => {
	const labelId = useId();
	const { data: model } = useQuery(
		orpc.model.find.queryOptions({
			input: value
				? {
						id: value,
					}
				: skipToken,
		}),
	);
	const providerId = model?.data.providerId;
	const { data: provider } = useQuery(
		orpc.provider.find.queryOptions({
			input: providerId
				? {
						id: providerId,
					}
				: skipToken,
		}),
	);
	const unusableReason =
		model && provider
			? modelUnusableReason(
					{
						capabilities: model.data.capabilities,
						isDeprecated: model.data.isDeprecated,
						providerEnabled: provider.data.enabled,
					},
					setting.use,
				)
			: undefined;

	return (
		<Field aria-labelledby={labelId}>
			<FieldContent>
				<FieldLabel id={labelId}>{setting.label()}</FieldLabel>
				<FieldDescription>{setting.description()}</FieldDescription>
			</FieldContent>
			<div className="flex items-center gap-2">
				<ModelSelectorButton
					selectedModelId={value ?? undefined}
					selectedProviderId={providerId}
					onSelect={(selected) => onChange(selected.id)}
					excludeDeprecated
					capabilities={pickerCapabilities[setting.use]}
					variant="full"
				/>
				{value && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onChange(null)}
					>
						{m.orgs_form_model_clear_action()}
					</Button>
				)}
			</div>
			{!value && (
				<p className="text-muted-foreground text-sm">{setting.unsetHint()}</p>
			)}
			{unusableReason && (
				<p className="flex items-start gap-2 text-destructive text-sm">
					<TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
					{setting.unusable[unusableReason]()}
				</p>
			)}
		</Field>
	);
};

/** The setting's next value, left out when unchanged so an unusable model does not block other edits. */
const changedModel = <Key extends string>(
	key: Key,
	next: string | null,
	current: ModelId | null,
) => {
	const nextId = next === null ? null : modelIdSchema.parse(next);
	return nextId === current
		? {}
		: ({
				[key]: nextId,
			} as Record<Key, ModelId | null>);
};

export const OrganizationForm = ({
	action,
	organization,
	onCompleted,
}: OrganizationFormProps) => {
	const { mutateAsync: createOrganization } = useCreateOrganizationMutation({
		onSuccess: onCompleted,
	});
	const { mutateAsync: updateOrganization } = useUpdateOrganizationMutation({
		onSuccess: onCompleted,
	});

	const form = useAppForm({
		...organizationFormOptions,
		defaultValues: organization
			? {
					name: organization.name,
					slug: organization.slug,
					logo: organization.logo,
					assistantModelId: organization.assistantModelId,
					utilityModelId: organization.utilityModelId,
				}
			: organizationFormOptions.defaultValues,
		onSubmit: async ({ value }) => {
			const { assistantModelId, utilityModelId, ...rest } = value;
			const fields = {
				...rest,
				logo: rest.logo?.trim() || null,
			};
			if (action === "update") {
				await updateOrganization({
					...fields,
					id: organization.id,
					...changedModel(
						"assistantModelId",
						assistantModelId,
						organization.assistantModelId,
					),
					...changedModel(
						"utilityModelId",
						utilityModelId,
						organization.utilityModelId,
					),
				});
			} else {
				await createOrganization(fields);
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
				name="name"
				children={(field) => (
					<field.TextField
						label={m.orgs_form_name_label()}
						placeholder={m.orgs_form_name_placeholder()}
					/>
				)}
			/>
			<form.AppField
				name="slug"
				children={(field) => (
					<field.TextField
						label={m.orgs_form_slug_label()}
						placeholder={m.orgs_form_slug_placeholder()}
					/>
				)}
			/>
			<form.AppField
				name="logo"
				children={(field) => (
					<field.TextField
						label={m.orgs_form_logo_label()}
						placeholder={m.orgs_form_logo_placeholder()}
					/>
				)}
			/>
			{action === "update" && (
				<>
					<form.AppField
						name="assistantModelId"
						children={(field) => (
							<OrganizationModelField
								setting={assistantModelSetting}
								value={field.state.value}
								onChange={field.handleChange}
							/>
						)}
					/>
					<form.AppField
						name="utilityModelId"
						children={(field) => (
							<OrganizationModelField
								setting={utilityModelSetting}
								value={field.state.value}
								onChange={field.handleChange}
							/>
						)}
					/>
				</>
			)}

			<div className="flex justify-end pt-4">
				<form.AppForm>
					<form.SubmitButton label={m.orgs_form_submit_button()} />
				</form.AppForm>
			</div>
		</form>
	);
};
