import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FormInputField } from "@/components/forms/fields/formInputField";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { type UserUpdateSchemaType, userUpdateSchema } from "@/db/zod/profile";
import { authClient } from "@/lib/auth-client";

const ProfileForm = () => {
	const { data, isPending } = authClient.useSession();
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);

	const form = useForm<UserUpdateSchemaType>({
		resolver: zodResolver(userUpdateSchema),
		defaultValues: {
			name: data?.user.name,
		},
	});

	// FIXME: Pass data as props instead of this shit?
	// biome-ignore lint/correctness/useExhaustiveDependencies: <FIXME: Check later>
	useEffect(() => {
		form.reset({
			name: data?.user.name,
		});

		if (!isPending && data) {
			setLoading(false);
		}
	}, [data]);

	const onSubmit = async (values: UserUpdateSchemaType) => {
		await authClient.updateUser(
			{
				name: values.name,
			},
			{
				onRequest: () => {
					setSubmitting(true);
					console.log("loading");
				},
				onSuccess: () => {
					setSubmitting(false);
					console.log("success");
				},
				onError: () => {
					setSubmitting(false);
					console.log("error");
				},
			},
		);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormInputField
							field={field}
							placeholder="Your name"
							label="Name"
							inputType="text"
							loading={loading}
						/>
					)}
				/>
				<Button type="submit" disabled={loading || submitting}>
					Save Profile
				</Button>
			</form>
		</Form>
	);
};

export { ProfileForm };
