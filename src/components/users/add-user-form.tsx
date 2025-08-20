import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { AlertCircle, CircleMinusIcon } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormSelectField } from "@/components/forms/fields/form-select-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import type { Course } from "@/lib/orpc/schemas/course";
import { organizationInvitationQueryOptions } from "@/lib/query-options/organization-invitation";

// Define Zod schema
const schema = z.object({
	courseId: z.string().nonempty("Please select a course"),
	items: z
		.array(
			z.object({
				email: z.email("Field must be a valid email"),
			}),
		)
		.check((ctx) => {
			const emails = ctx.value.map((item) => item.email.toLowerCase());
			const uniqueEmails = new Set(emails);

			if (uniqueEmails.size !== emails.length) {
				ctx.issues.push({
					code: "invalid_type",
					expected: "string",
					message: "Emails must be unique",
					path: ["root"],
					input: ctx.value,
				});
			}
		}),
});

type FormValues = z.infer<typeof schema>;

const AddUserForm = ({ courses }: { courses: Course[] }) => {
	const { auth } = useRouteContext({ from: "/app" });
	const queryClient = useQueryClient();
	const { mutateAsync: createInvitation } = useMutation(
		organizationInvitationQueryOptions.create(queryClient),
	);

	const form = useForm({
		resolver: zodResolver(schema),
		defaultValues: {
			courseId: undefined,
			items: [{ email: "" }],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "items",
	});

	const onSubmit = (data: FormValues) => {
		if (!auth.session.activeOrganizationId) {
			toast.error("No active organization found");
			return;
		}

		const invitationData = {
			organizationId: auth.session.activeOrganizationId,
			role: "member", // TODO: Make this configurable
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
			items: data.items.map((item) => ({
				email: item.email.toLowerCase(),
			})),
		};

		toast.promise(createInvitation(invitationData), {
			loading: "Creating invitation...",
			success: () => {
				form.reset();
				return "Invitation created successfully";
			},
			error: (error) => ({
				message: "Failed to create invitation",
				description: error.message,
			}),
		});
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<p>Invite Users</p>
				<p className="text-muted-foreground text-sm">
					You can invite multiple users at once by adding additional email
					fields. Currently no emails will be sent. Instead you can copy an
					invitation link that you can manually provide to each user.
				</p>
				<div className="mt-8 flex max-w-[500px] flex-col gap-2">
					<FormSelectField
						form={form}
						name="courseId"
						label="Course"
						placeholder="Select course"
						options={courses.map((course) => ({
							label: course.title,
							value: course.id,
						}))}
						required={true}
					/>

					{fields.map((field, index) => (
						<div key={field.id}>
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
				</div>

				<div className="mt-4 flex flex-row gap-2">
					<Button variant="outline" onClick={() => append({ email: "" })}>
						Add email field
					</Button>
					<Button type="submit">Invite Users</Button>
				</div>
			</form>
		</Form>
	);
};

export { AddUserForm };
