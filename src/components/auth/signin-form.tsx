import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/formInputField";
import { FormPasswordField } from "@/components/forms/fields/formPasswordField";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
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

	const onSubmit = async (values: LoginSchemaType) => {
		await authClient.signIn.email(
			{
				email: values.email,
				password: values.password,
			},
			{
				onSuccess: (_ctx) => {
					trackEvent("auth-login", {
						email: values.email,
					});
					toast.message("Welcome back!");

					navigate({ to: "/" });
				},
				onError: (ctx) => {
					toast.error("An error occured.", { description: ctx.error.message });
				},
			},
		);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormInputField
							field={field}
							placeholder="your@email.com"
							label="Email"
							inputType="email"
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormPasswordField
							field={field}
							placeholder="Password"
							label="Password"
							showTogglePassword
						/>
					)}
				/>
				<Button type="submit" className="w-full">
					Login
				</Button>
			</form>
		</Form>
	);
};

export { SignInForm };
