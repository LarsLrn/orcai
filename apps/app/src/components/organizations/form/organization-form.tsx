import { modelIdSchema, type Organization } from "@orcai/schema";
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

const unusableMessages: Record<ModelUnusableReason, () => string> = {
	PROVIDER_DISABLED: m.orgs_form_assistant_model_unusable_provider_disabled,
	MODEL_DEPRECATED: m.orgs_form_assistant_model_unusable_deprecated,
	MODEL_TOOLS_UNSUPPORTED:
		m.orgs_form_assistant_model_unusable_tools_unsupported,
};

/** The chat model picker, limited to usable models, warning when the chosen one no longer is. */
const AssistantModelField = ({
	value,
	onChange,
}: {
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
			? modelUnusableReason({
					capabilities: model.data.capabilities,
					isDeprecated: model.data.isDeprecated,
					providerEnabled: provider.data.enabled,
				})
			: undefined;

	return (
		<Field aria-labelledby={labelId}>
			<FieldContent>
				<FieldLabel id={labelId}>
					{m.orgs_form_assistant_model_label()}
				</FieldLabel>
				<FieldDescription>
					{m.orgs_form_assistant_model_description()}
				</FieldDescription>
			</FieldContent>
			<div className="flex items-center gap-2">
				<ModelSelectorButton
					selectedModelId={value ?? undefined}
					selectedProviderId={providerId}
					onSelect={(selected) => onChange(selected.id)}
					excludeDeprecated
					variant="full"
				/>
				{value && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onChange(null)}
					>
						{m.orgs_form_assistant_model_clear_action()}
					</Button>
				)}
			</div>
			{!value && (
				<p className="text-muted-foreground text-sm">
					{m.orgs_form_assistant_model_unset_hint()}
				</p>
			)}
			{unusableReason && (
				<p className="flex items-start gap-2 text-destructive text-sm">
					<TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
					{unusableMessages[unusableReason]()}
				</p>
			)}
		</Field>
	);
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
				}
			: organizationFormOptions.defaultValues,
		onSubmit: async ({ value }) => {
			const { assistantModelId, ...rest } = value;
			const fields = {
				...rest,
				logo: rest.logo?.trim() || null,
			};
			if (action === "update") {
				const nextAssistantModelId =
					assistantModelId === null
						? null
						: modelIdSchema.parse(assistantModelId);
				await updateOrganization({
					...fields,
					id: organization.id,
					// An unchanged model is not revalidated, so an unusable one does not block other edits.
					...(nextAssistantModelId !== organization.assistantModelId
						? {
								assistantModelId: nextAssistantModelId,
							}
						: {}),
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
				<form.AppField
					name="assistantModelId"
					children={(field) => (
						<AssistantModelField
							value={field.state.value}
							onChange={field.handleChange}
						/>
					)}
				/>
			)}

			<div className="flex justify-end pt-4">
				<form.AppForm>
					<form.SubmitButton label={m.orgs_form_submit_button()} />
				</form.AppForm>
			</div>
		</form>
	);
};
