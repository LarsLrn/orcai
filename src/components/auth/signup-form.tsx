import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { FormPasswordField } from "@/components/forms/fields/form-password-field";
import { FormSwitchField } from "@/components/forms/fields/form-switch-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import type { CourseInvitation } from "@/db/schema/course-invitation";
import { type SignupSchemaType, signupSchema } from "@/db/zod/signup";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth-client";

const SignUpForm = ({
	invitation,
}: {
	invitation: CourseInvitation | undefined;
}) => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	const form = useForm<SignupSchemaType>({
		resolver: zodResolver(signupSchema),
		defaultValues: {
			email: invitation?.email || "",
			password: "",
			confirmPassword: "",
			invitationId: invitation?.id || "",
			privacyConsent: false,
		},
	});

	const onSubmit = (values: SignupSchemaType) => {
		if (invitation?.id !== values.invitationId) {
			return;
		}

		toast.promise(
			authClient.signUp.email({
				name: values.name ?? "User",
				email: values.email,
				password: values.password,
			}),
			{
				loading: "Creating your account...",
				success: async () => {
					trackEvent("auth-register", {
						email: values.email,
						invitationId: values.invitationId,
					});
					toast.success("Welcome to Sokratesᵗ!");
					await navigate({ to: "/", replace: true });
					return "Account successfully created!";
				},
				error: (error) => ({
					message: "Account creation failed",
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
					name="name"
					placeholder="Your Name"
					label="Name"
					inputType="text"
				/>

				<FormInputField
					form={form}
					name="email"
					disabled={invitation && true}
					placeholder="your@email.com"
					label="Email"
					inputType="email"
				/>

				<FormInputField
					form={form}
					name="invitationId"
					disabled={invitation && true}
					placeholder="Unique invitation code"
					label="Invitation Code"
					inputType="text"
				/>

				<FormPasswordField
					form={form}
					name="password"
					placeholder="Password"
					label="Password"
					showTogglePassword
					showStrength={true}
				/>

				<FormPasswordField
					form={form}
					name="confirmPassword"
					placeholder="Password"
					label="Confirm Password"
					showTogglePassword
				/>
				<div className="space-y-4 rounded-lg border bg-background/50 p-4 shadow-sm">
					<div className="space-y-2">
						<h3 className="font-semibold">Privacy Policy</h3>
						<p className="text-muted-foreground text-sm">
							By signing up, you agree to our Privacy Policy and Terms of Use.
							Please review each before continuing.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Link
							className={buttonVariants({
								variant: "outline",
								size: "sm",
							})}
							to={"/"}
						>
							<FileTextIcon /> Review Privacy Policy
						</Link>
						<Link
							className={buttonVariants({
								variant: "outline",
								size: "sm",
							})}
							to={"/"}
						>
							<FileTextIcon /> Review Terms of Use
						</Link>
					</div>

					<FormSwitchField
						form={form}
						name="privacyConsent"
						description="Yes, I have read, understood, and agree to the privacy policy and terms of use of the Sokratesᵗ platform."
					/>
				</div>
				<Button type="submit" className="w-full">
					Register
				</Button>
			</form>
		</Form>
	);
};

export { SignUpForm };
