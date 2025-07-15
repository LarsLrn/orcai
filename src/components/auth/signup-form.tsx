"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/formInputField";
import { FormPasswordField } from "@/components/forms/fields/formPasswordField";
import { FormSwitch } from "@/components/forms/fields/formSwitch";
import { Button, buttonVariants } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import type { CourseInvitation } from "@/db/schema/course-invitation";
import { type SignupSchemaType, signupSchema } from "@/db/zod/signup";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth-client";

const SignUpForm = ({ invitation }: { invitation: CourseInvitation }) => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	const form = useForm<SignupSchemaType>({
		resolver: zodResolver(signupSchema),
		defaultValues: {
			email: invitation.email,
			password: undefined,
			confirmPassword: undefined,
			invitationId: invitation.id,
			privacyConsent: false,
		},
	});

	const onSubmit = async (values: SignupSchemaType) => {
		if (invitation.id !== values.invitationId) {
			return;
		}

		await authClient.signUp.email(
			{
				name: values.name ?? "User",
				email: values.email,
				password: values.password,
			},
			{
				onSuccess: async (_ctx) => {
					trackEvent("auth-register", {
						email: values.email,
						invitationId: values.invitationId,
					});
					toast.success("Welcome to Sokratesᵗ!");
					navigate({ to: "/", replace: true });
				},
				onError: (ctx) => {
					toast.error("An error occured.", {
						description: ctx.error.message,
					});
				},
			},
		);
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormInputField
							field={field}
							placeholder="Your Name"
							label="Name"
							inputType="text"
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormInputField
							disabled={invitation && true}
							field={field}
							placeholder="your@email.com"
							label="Email"
							inputType="email"
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="invitationId"
					render={({ field }) => (
						<FormInputField
							disabled={invitation && true}
							field={field}
							placeholder="Unique invitation code"
							label="Invitation Code"
							inputType="text"
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
				<FormField
					control={form.control}
					name="confirmPassword"
					render={({ field }) => (
						<FormPasswordField
							field={field}
							placeholder="Password"
							label="Confirm Password"
							showTogglePassword
						/>
					)}
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

					<FormField
						control={form.control}
						name="privacyConsent"
						render={({ field }) => (
							<FormSwitch
								field={field}
								description="Yes, I have read, understood, and agree to the privacy policy and terms of use of the Sokratesᵗ platform."
							/>
						)}
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
