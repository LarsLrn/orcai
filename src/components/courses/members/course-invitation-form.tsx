import { zodResolver } from "@hookform/resolvers/zod";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, CircleMinusIcon } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormDatetimeField } from "@/components/forms/fields/form-datetime-field";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormSelectField } from "@/components/forms/fields/form-select-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	type CourseInvitationsInsertSchemaType,
	courseInvitationsInsertSchema,
} from "@/db/zod/course-invitation";
import { orpc } from "@/lib/orpc/orpc";

const CourseInvitationForm = () => {
	const { data: courses } = useSuspenseQuery(
		orpc.course.list.queryOptions({
			input: { pageIndex: 0, pageSize: 100 },
			queryKey: orpc.course.list.key(),
		}),
	);

	const queryClient = useQueryClient();
	const { mutateAsync: createCourseInvitations } = useMutation(
		orpc.courseInvitation.create.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: orpc.courseInvitation.key(),
				});
			},
		}),
	);

	const navigate = useNavigate();

	const form = useForm<CourseInvitationsInsertSchemaType>({
		resolver: zodResolver(courseInvitationsInsertSchema),
		defaultValues: {
			courseId: undefined,
			items: [{ email: "" }],
		},
		mode: "onSubmit", // Only validate when the form is submitted
	});

	const { fields, append, remove, replace } = useFieldArray({
		control: form.control,
		name: "items",
	});

	const onSubmit = (values: CourseInvitationsInsertSchemaType) => {
		toast.promise(createCourseInvitations(values), {
			loading: "Creating course invitation...",
			success: async () => {
				await navigate({ to: "/app/users/invites" });
				return "Course invitation created successfully";
			},
			error: (error) => ({
				message: "Failed to create course invitation",
				description: error.message,
			}),
		});
	};

	const handleBulkPaste = (textArea: HTMLTextAreaElement) => {
		const rawEmails = textArea.value as string;

		const emails = rawEmails
			.split("\n")
			.map((email) => email.trim())
			.filter((email) => email.length > 0);

		replace(emails.map((email) => ({ email })));
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="grid grid-cols-1 gap-4 lg:grid-cols-2"
			>
				<Card className="order-last h-fit lg:order-first">
					<CardHeader>
						<CardTitle>Set invitation details</CardTitle>
						<CardDescription>
							These settings will apply to all users invited in this batch. Note
							that users will also automatically be added to the organisation
							corresponding to the course.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<FormSelectField
							form={form}
							name="courseId"
							label="Course"
							placeholder="Select course"
							options={courses.data.map((course) => ({
								label: course.title,
								value: course.id,
							}))}
							required={true}
						/>

						<FormSelectField
							form={form}
							name="role"
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
							required={true}
						/>

						<FormDatetimeField
							form={form}
							name="expiresAt"
							label="Expires At"
							showTimePicker={true}
							placeholder="Select expiration date"
							required={true}
						/>

						<Button type="submit" className="w-fit">
							Create Invitations
						</Button>
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
						{fields.map((field, index) => (
							<div key={field.id} className="flex flex-col gap-2">
								<Label htmlFor={`items.${index}.email`}>
									User {index + 1} Email
								</Label>
								<div className="flex flex-row items-start gap-2">
									<FormInputField
										form={form}
										name={`items.${index}.email`}
										className="w-full"
										placeholder="User email"
										inputType="email"
									/>

									{fields.length > 1 && (
										<Button
											size="icon"
											variant="destructive"
											onClick={() => remove(index)}
										>
											<CircleMinusIcon />
										</Button>
									)}
								</div>
							</div>
						))}
						{form.formState.errors.items?.root && (
							<Alert variant="destructive" className="my-4">
								<AlertCircle className="h-4 w-4" />
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>
									{form.formState.errors.items.root.message}
								</AlertDescription>
							</Alert>
						)}
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => append({ email: "" })}
							>
								Add email field
							</Button>
							<Dialog>
								<DialogTrigger asChild>
									<Button variant="outline">Bulk Add Emails</Button>
								</DialogTrigger>
								<DialogContent className="max-w-[600px]">
									<DialogHeader>
										<DialogTitle>Bulk Add Emails</DialogTitle>
										<DialogDescription>
											Add multiple emails at once once by pasting them here.
											Make sure each email is on a new line and formatted
											correctly.
										</DialogDescription>
									</DialogHeader>
									<div className="flex flex-col gap-4">
										<Textarea
											name="bulkEmails"
											id="bulkEmails"
											rows={5}
											placeholder="Add emails here, separated by new lines"
										/>
										<DialogClose asChild>
											<Button
												type="button"
												onClick={() => {
													const textArea = document.getElementById(
														"bulkEmails",
													) as HTMLTextAreaElement;

													handleBulkPaste(textArea);
												}}
											>
												Add Emails
											</Button>
										</DialogClose>
									</div>
								</DialogContent>
							</Dialog>
						</div>
					</CardContent>
				</Card>
			</form>
		</Form>
	);
};

export { CourseInvitationForm };
