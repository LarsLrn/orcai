import { zodResolver } from "@hookform/resolvers/zod";
import { useRouteContext } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { type UserUpdateSchemaType, userUpdateSchema } from "@/db/zod/profile";
import { authClient } from "@/lib/auth-client";

const ProfileForm = () => {
	const { auth } = useRouteContext({ from: "/app" });
	const { refetch } = authClient.useSession();

	const form = useForm<UserUpdateSchemaType>({
		resolver: zodResolver(userUpdateSchema),
		defaultValues: {
			name: auth.user.name,
		},
	});

	const onSubmit = (values: UserUpdateSchemaType) => {
		toast.promise(
			authClient.updateUser({
				name: values.name,
			}),
			{
				loading: "Saving profile...",
				success: () => {
					refetch(); // Refetch session with updated user data
					return "Profile updated successfully!";
				},
				error: (error) => ({
					message: "Failed to update profile",
					description: error.message,
				}),
			},
		);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormInputField
					form={form}
					name="name"
					placeholder="Your name"
					label="Name"
					inputType="text"
				/>
				<Button type="submit">Save Profile</Button>
			</form>
		</Form>
	);
};

export { ProfileForm };
