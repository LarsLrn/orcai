import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormPasswordField } from "@/components/forms/fields/form-password-field";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { type LoginSchemaType, loginSchema } from "@/db/zod/login";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth-client";

const SignInForm = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	const form = useForm<LoginSchemaType>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: undefined,
			password: undefined,
		},
	});

	const onSubmit = (values: LoginSchemaType) => {
		toast.promise(
			authClient.signIn.email({
				email: values.email,
				password: values.password,
			}),
			{
				loading: "Logging in...",
				success: async () => {
					trackEvent("auth-login", {
						email: values.email,
					});

					await navigate({ to: "/app" });

					return "Welcome back!";
				},
				error: (error) => ({
					message: "Login failed",
					description: error.message,
				}),
			},
		);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
				<FormInputField
					form={form}
					name="email"
					placeholder="your@email.com"
					label="Email"
					inputType="email"
				/>

				<FormPasswordField
					form={form}
					name="password"
					placeholder="Password"
					label="Password"
					showTogglePassword
				/>

				<Button type="submit" className="w-full">
					Login
				</Button>
			</form>
		</Form>
	);
};

export { SignInForm };
