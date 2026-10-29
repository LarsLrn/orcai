import type { OrganizationInvitation, OrganizationRole } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { CircleMinusIcon } from "lucide-react";
import { useId } from "react";
import { LOCALE_NAMES } from "@/components/app/locale/locale-names";
import { formTriggerText } from "@/components/forms/fields/form-field";
import {
	FormActions,
	FormPair,
	FormSection,
} from "@/components/forms/form-layout";
import { OrganizationRolePicker } from "@/components/organizations/organization-role-picker";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useAppForm } from "@/hooks/form";
import { useCreateOrganizationInvitationMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import { getAssignableOrganizationRoles } from "@/lib/authz/organization-role-metadata";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { locales } from "@/paraglide/runtime";
import { organizationInvitationFormOptions } from "./organization-invitation-form-options";

const OrganizationInvitationForm = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { mutateAsync: createInvitation } =
		useCreateOrganizationInvitationMutation();
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);

	const bulkEmailsId = useId();

	const organizationNameId = useId();
	const roleLabelId = useId();

	const { data: organization } = useSuspenseQuery(
		orpc.organization.find.queryOptions({
			input: {
				id: auth.session.activeOrganizationId,
			},
		}),
	);
	const assignableRoles = getAssignableOrganizationRoles({
		canManageOrganization:
			capabilities?.data.capabilities.manage_organization === true,
	});

	const form = useAppForm({
		...organizationInvitationFormOptions(),
		onSubmit: async ({ value }) => {
			await createInvitation({
				...value,
				role: value.role as OrganizationInvitation["role"],
			});
		},
	});

	const handleBulkPaste = (textArea: HTMLTextAreaElement) => {
		const rawEmails = textArea.value as string;

		const emails = rawEmails
			.split("\n")
			.map((email) => email.trim())
			.filter((email) => email.length > 0);

		form.setFieldValue(
			"items",
			emails.map((email) => ({
				email,
			})),
		);
	};

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-5"
			noValidate
		>
			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<FormSection
				title={m.orgs_invitation_form_details_title()}
				description={m.orgs_invitation_form_details_description()}
			>
				<Field>
					<FieldLabel htmlFor={organizationNameId}>
						{m.orgs_invitation_form_organisation_label()}
					</FieldLabel>
					<Input
						id={organizationNameId}
						value={organization.data.name}
						readOnly
						className="sm:max-w-md"
					/>
				</Field>

				<form.AppField
					name="role"
					children={(field) => (
						<Field role="group" aria-labelledby={roleLabelId}>
							<FieldLabel id={roleLabelId}>
								{m.orgs_invitation_form_role_label()}
							</FieldLabel>
							<OrganizationRolePicker
								value={field.state.value as OrganizationRole}
								onValueChange={(role) => field.handleChange(role)}
								variant="full"
								className={cn("sm:max-w-xs", formTriggerText)}
								title={m.orgs_invitation_form_role_picker_title()}
								roles={assignableRoles}
							/>
						</Field>
					)}
				/>

				<FormPair>
					<form.AppField
						name="expiresAt"
						children={(field) => (
							<field.DatetimeField
								label={m.orgs_invitation_form_expires_label()}
								placeholder={m.orgs_invitation_form_expires_placeholder()}
								showTimePicker={true}
							/>
						)}
					/>

					<form.AppField
						name="locale"
						children={(field) => (
							<field.SelectField
								label={m.orgs_invitation_form_locale_label()}
								description={m.orgs_invitation_form_locale_description()}
								width="full"
								options={locales.map((locale) => ({
									label: LOCALE_NAMES[locale],
									value: locale,
								}))}
							/>
						)}
					/>
				</FormPair>
			</FormSection>

			<FormSection
				title={m.orgs_invitation_form_emails_title()}
				description={m.orgs_invitation_form_emails_description()}
			>
				<form.AppField name="items" mode="array">
					{(field) => {
						return (
							<div className="flex flex-col gap-4">
								{field.state.value.map((_, index) => {
									return (
										<div
											key={index}
											className="flex flex-row items-end gap-2 sm:max-w-md"
										>
											<form.AppField
												name={`items[${index}].email`}
												children={(field) => (
													<field.TextField
														label={m.orgs_invitation_form_email_label({
															position: index + 1,
														})}
														placeholder={m.orgs_invitation_form_email_placeholder()}
													/>
												)}
											/>
											{field.state.value.length > 1 && (
												<Button
													type="button"
													size="icon"
													variant="destructive"
													aria-label={m.orgs_invitation_form_remove_email_aria_label(
														{
															position: index + 1,
														},
													)}
													onClick={() => field.removeValue(index)}
												>
													<CircleMinusIcon aria-hidden="true" />
												</Button>
											)}
										</div>
									);
								})}
							</div>
						);
					}}
				</form.AppField>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() =>
							form.insertFieldValue(
								"items",
								form.state.values.items.length + 1,
								{
									email: "",
								},
							)
						}
					>
						{m.orgs_invitation_form_add_email_button()}
					</Button>
					<Dialog>
						<DialogTrigger
							render={
								<Button variant="outline">
									{m.orgs_invitation_form_bulk_button()}
								</Button>
							}
						/>
						<DialogContent className="max-w-150">
							<DialogHeader>
								<DialogTitle>
									{m.orgs_invitation_form_bulk_dialog_title()}
								</DialogTitle>
								<DialogDescription>
									{m.orgs_invitation_form_bulk_dialog_description()}
								</DialogDescription>
							</DialogHeader>
							<div className="flex flex-col gap-4">
								<Textarea
									name="bulkEmails"
									id={bulkEmailsId}
									rows={5}
									placeholder={m.orgs_invitation_form_bulk_placeholder()}
								/>
								<DialogClose
									render={
										<Button
											type="button"
											onClick={() => {
												const textArea = document.getElementById(
													bulkEmailsId,
												) as HTMLTextAreaElement;

												handleBulkPaste(textArea);
											}}
										>
											{m.orgs_invitation_form_bulk_confirm_button()}
										</Button>
									}
								/>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</FormSection>

			<form.AppForm>
				<FormActions>
					<form.SubmitButton label={m.orgs_invitation_form_submit_button()} />
				</FormActions>
			</form.AppForm>
		</form>
	);
};

export { OrganizationInvitationForm };
