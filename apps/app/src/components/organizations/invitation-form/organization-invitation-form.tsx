import type { OrganizationInvitation, OrganizationRole } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { CircleMinusIcon } from "lucide-react";
import { useId } from "react";
import { OrganizationRolePicker } from "@/components/organizations/organization-role-picker";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useAppForm } from "@/hooks/form";
import { useCreateOrganizationInvitationMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import { getAssignableOrganizationRoles } from "@/lib/authz/organization-role-metadata";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { organizationInvitationFormOptions } from "./organization-invitation-form-options";

const OrganizationInvitationForm = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { mutate: createInvitation } =
		useCreateOrganizationInvitationMutation();
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);

	const bulkEmailsId = useId();

	const { data: organizations } = useSuspenseQuery(
		orpc.organization.list.queryOptions({
			input: {
				pageIndex: 0,
				pageSize: 100,
			},
		}),
	);
	const initialOrganizationId = organizations.data.some(
		(organization) => organization.id === auth.session.activeOrganizationId,
	)
		? auth.session.activeOrganizationId
		: undefined;
	const assignableRoles = getAssignableOrganizationRoles({
		canManageOrganization:
			capabilities?.data.capabilities.manage_organization === true,
	});

	const form = useAppForm({
		...organizationInvitationFormOptions(initialOrganizationId),
		onSubmit: ({ value }) => {
			createInvitation({
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
			className="space-y-4"
			noValidate
		>
			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<Card className="order-last h-fit lg:order-first">
				<CardHeader>
					<CardTitle>{m.orgs_invitation_form_details_title()}</CardTitle>
					<CardDescription>
						{m.orgs_invitation_form_details_description()}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<form.AppField
						name="organizationId"
						children={(field) => (
							<field.SelectField
								label={m.orgs_invitation_form_organisation_label()}
								placeholder={m.orgs_invitation_form_organisation_placeholder()}
								options={organizations.data.map((organization) => ({
									label: organization.name,
									value: organization.id,
								}))}
							/>
						)}
					/>

					<form.AppField
						name="role"
						children={(field) => (
							<div className="space-y-2">
								<Label>{m.orgs_invitation_form_role_label()}</Label>
								<OrganizationRolePicker
									value={field.state.value as OrganizationRole}
									onValueChange={(role) => field.handleChange(role)}
									variant="full"
									title={m.orgs_invitation_form_role_picker_title()}
									roles={assignableRoles}
								/>
							</div>
						)}
					/>

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
				</CardContent>
			</Card>

			<Card className="h-fit">
				<CardHeader>
					<CardTitle>{m.orgs_invitation_form_emails_title()}</CardTitle>
					<CardDescription>
						{m.orgs_invitation_form_emails_description()}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<form.AppField name="items" mode="array">
						{(field) => {
							return (
								<div className="space-y-4">
									{field.state.value.map((_, index) => {
										return (
											<div
												key={index}
												className="flex flex-row items-end gap-2"
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
					<div className="flex gap-2">
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
				</CardContent>
			</Card>

			<div className="flex justify-end pt-4">
				<form.AppForm>
					<form.SubmitButton label={m.orgs_invitation_form_submit_button()} />
				</form.AppForm>
			</div>
		</form>
	);
};

export { OrganizationInvitationForm };
