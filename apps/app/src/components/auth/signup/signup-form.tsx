import type { OrganizationInvitationId } from "@orcai/core";
import { signupSchema } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAppForm } from "@/hooks/form";
import { useSignup } from "@/hooks/mutations/use-signup";
import { m } from "@/paraglide/messages";
import { signupFormOptions } from "./signup-form-options";

const SignUpForm = ({
	invitationId,
	email,
}: {
	invitationId: OrganizationInvitationId;
	email: string;
}) => {
	const { mutateAsync: signup } = useSignup();

	const form = useAppForm({
		...signupFormOptions({
			invitationId,
			email,
		}),
		onSubmit: async ({ value }) => {
			await signup(signupSchema.parse(value));
		},
	});

	return (
		<form
			method="post"
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<form.AppField
				name="name"
				children={(field) => (
					<field.TextField
						label={m.auth_signup_form_name_label()}
						placeholder={m.common_name_placeholder()}
					/>
				)}
			/>

			<form.AppField
				name="email"
				children={(field) => (
					<field.TextField
						label={m.common_email_label()}
						placeholder={m.common_email_placeholder()}
						type="email"
						disabled
					/>
				)}
			/>

			<form.AppField
				name="invitationId"
				children={(field) => (
					<field.TextField
						label={m.auth_signup_form_invitation_code_label()}
						placeholder={m.auth_signup_form_invitation_code_placeholder()}
						disabled
					/>
				)}
			/>

			<form.AppField
				name="password"
				children={(field) => (
					<field.PasswordField
						label={m.auth_signup_form_password_label()}
						placeholder={m.common_password_placeholder()}
						showStrength
					/>
				)}
			/>

			<form.AppField
				name="confirmPassword"
				children={(field) => (
					<field.PasswordField
						label={m.auth_signup_form_confirm_password_label()}
						placeholder={m.common_confirm_password_placeholder()}
					/>
				)}
			/>

			<div className="space-y-4 rounded-2xl border bg-background/50 p-4 shadow-sm">
				<div className="space-y-2">
					<h3 className="font-semibold">
						{m.auth_signup_form_privacy_policy_title()}
					</h3>
					<p className="text-muted-foreground text-sm">
						{m.auth_signup_form_privacy_policy_body()}
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
						<FileTextIcon /> {m.auth_signup_form_review_privacy_link()}
					</Link>
					<Link
						className={buttonVariants({
							variant: "outline",
							size: "sm",
						})}
						to={"/tou"}
					>
						<FileTextIcon /> {m.auth_signup_form_review_terms_link()}
					</Link>
				</div>

				<form.AppField
					name="privacyConsent"
					children={(field) => (
						<field.SwitchField
							label={m.auth_signup_form_privacy_consent_label()}
							description={m.auth_signup_form_privacy_consent_description()}
						/>
					)}
				/>
			</div>

			<form.AppForm>
				<form.SubmitButton
					label={m.auth_signup_form_submit_button()}
					className="w-full"
				/>
			</form.AppForm>
		</form>
	);
};

export { SignUpForm };
