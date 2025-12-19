import { Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAppForm } from "@/hooks/form";
import type { CourseInvitation } from "@/lib/orpc/schemas/course-invitations";
import { signupFormOptions } from "./signup-form-options";
import { useSignupSubmission } from "./use-signup";

const SignUpForm = ({
	invitation,
}: {
	invitation: CourseInvitation | undefined;
}) => {
	const submit = useSignupSubmission();

	const form = useAppForm({
		...signupFormOptions({
			email: invitation?.email,
			invitationId: invitation?.id,
		}),
		onSubmit: ({ value }) => {
			submit(value);
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<form.AppField
				name="name"
				children={(field) => (
					<field.TextField label="Name" placeholder="Your Name" />
				)}
			/>

			<form.AppField
				name="email"
				children={(field) => (
					<field.TextField
						label="Email"
						placeholder="your@email.com"
						type="email"
						disabled={!!invitation}
					/>
				)}
			/>

			<form.AppField
				name="invitationId"
				children={(field) => (
					<field.TextField
						label="Invitation Code"
						placeholder="Unique invitation code"
						disabled={!!invitation}
					/>
				)}
			/>

			<form.AppField
				name="password"
				children={(field) => (
					<field.PasswordField
						label="Password"
						placeholder="Password"
						showStrength
					/>
				)}
			/>

			<form.AppField
				name="confirmPassword"
				children={(field) => (
					<field.PasswordField
						label="Confirm Password"
						placeholder="Confirm Password"
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
						to={"/privacy"}
					>
						<FileTextIcon /> Review Privacy Policy
					</Link>
					<Link
						className={buttonVariants({
							variant: "outline",
							size: "sm",
						})}
						to={"/tou"}
					>
						<FileTextIcon /> Review Terms of Use
					</Link>
				</div>

				<form.AppField
					name="privacyConsent"
					children={(field) => (
						<field.SwitchField
							label="Privacy Consent"
							description="Yes, I have read, understood, and agree to the privacy policy and terms of use of the Sokratesᵗ platform."
						/>
					)}
				/>
			</div>

			<form.AppForm>
				<form.SubmitButton label="Register" className="w-full" />
			</form.AppForm>
		</form>
	);
};

export { SignUpForm };
