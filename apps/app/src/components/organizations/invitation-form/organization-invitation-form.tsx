import type { OrganizationInvitation } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { CircleMinusIcon } from "lucide-react";
import { useId } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAppForm } from "@/hooks/form";
import { useCreateOrganizationInvitationMutation } from "@/hooks/mutations/use-organization-invitation-mutations";
import { orpc } from "@/lib/orpc/orpc";
import { organizationInvitationFormOptions } from "./organization-invitation-form-options";

const OrganizationInvitationForm = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { mutate: createInvitation } =
		useCreateOrganizationInvitationMutation();

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
					<CardTitle>Set invitation details</CardTitle>
					<CardDescription>
						These settings will apply to all users invited in this batch. Note
						that users will also automatically be added to the organisation
						corresponding to the selected organisation.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<form.AppField
						name="organizationId"
						children={(field) => (
							<field.SelectField
								label="Organisation"
								placeholder="Select organisation"
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
							<field.SelectField
								label="Role"
								placeholder="Select role"
								// TODO: Replace with global roles defined in spiceDb
								options={[
									{
										label: "Instructor",
										value: "instructor",
									},
									{
										label: "Student",
										value: "student",
									},
								]}
							/>
						)}
					/>

					<form.AppField
						name="expiresAt"
						children={(field) => (
							<field.DatetimeField
								label="Expires At"
								placeholder="Select expiration date"
								showTimePicker={true}
							/>
						)}
					/>
				</CardContent>
			</Card>

			<Card className="h-fit">
				<CardHeader>
					<CardTitle>Add user emails</CardTitle>
					<CardDescription>
						Add the emails of users you want to invite. You can manually add
						each email, or all at once using &quot;Bulk Add Emails&quot;.
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
															label={`User ${index + 1} Email`}
															placeholder="User email"
														/>
													)}
												/>
												{field.state.value.length > 1 && (
													<Button
														type="button"
														size="icon"
														variant="destructive"
														onClick={() => field.removeValue(index)}
													>
														<CircleMinusIcon />
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
							Add email field
						</Button>
						<Dialog>
							<DialogTrigger
								render={<Button variant="outline">Bulk Add Emails</Button>}
							/>
							<DialogContent className="max-w-150">
								<DialogHeader>
									<DialogTitle>Bulk Add Emails</DialogTitle>
									<DialogDescription>
										Add multiple emails at once once by pasting them here. Make
										sure each email is on a new line and formatted correctly.
									</DialogDescription>
								</DialogHeader>
								<div className="flex flex-col gap-4">
									<Textarea
										name="bulkEmails"
										id={bulkEmailsId}
										rows={5}
										placeholder="Add emails here, separated by new lines"
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
												Add Emails
											</Button>
										}
									/>
								</div>
							</DialogContent>
						</Dialog>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end border-t pt-4">
				<form.AppForm>
					<form.SubmitButton label="Create Invitations" />
				</form.AppForm>
			</div>
		</form>
	);
};

export { OrganizationInvitationForm };
