"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";
import { FormPasswordField } from "@/components/forms/fields/formPasswordField";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { sharedSchemas } from "@/db/zod/shared";
import { orpc } from "@/lib/orpc/orpc";

// Define the schema locally by picking fields from signupSchema
const changePasswordSchema = z
	.object({
		currentPassword: sharedSchemas.password,
		password: sharedSchemas.password,
		confirmPassword: sharedSchemas.password,
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords must match",
		path: ["confirmPassword"],
	});

// Infer the type from the local schema
type ChangePasswordSchemaType = z.infer<typeof changePasswordSchema>;

const ChangePasswordForm = () => {
	const { mutateAsync: updatePassword } = useMutation(
		orpc.user.updatePassword.mutationOptions(),
	);

	const form = useForm<ChangePasswordSchemaType>({
		resolver: zodResolver(changePasswordSchema),
		defaultValues: {
			currentPassword: "",
			password: "",
			confirmPassword: "",
		},
	});

	const onSubmit = async (values: ChangePasswordSchemaType) => {
		toast.promise(
			updatePassword({
				currentPassword: values.currentPassword,
				password: values.password,
			}),

			{
				loading: "Changing password...",
				success: () => {
					form.reset(); // Reset form on success
					return "Password changed";
				},
				error: (error) => ({
					message: "Failed to change password",
					description: error.message,
				}),
			},
		);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="currentPassword"
					render={({ field }) => (
						<FormPasswordField
							field={field}
							label="Current Password"
							placeholder="Enter your current password"
							showTogglePassword
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormPasswordField
							field={field}
							label="New Password"
							placeholder="Enter new password"
							showTogglePassword
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="confirmPassword"
					render={({ field }) => (
						<FormPasswordField
							field={field}
							label="Confirm New Password"
							placeholder="Confirm new password"
							showTogglePassword
						/>
					)}
				/>
				<Button
					type="submit"
					variant="destructive"
					disabled={form.formState.isSubmitting}
				>
					{form.formState.isSubmitting ? "Changing..." : "Change Password"}
				</Button>
			</form>
		</Form>
	);
};

export { ChangePasswordForm };
