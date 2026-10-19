import { useAppForm } from "@/hooks/form";
import { useResendVerificationEmail } from "@/hooks/mutations/use-resend-verification-email";
import { m } from "@/paraglide/messages";
import { verifyEmailFormOptions } from "./verify-email-form-options";

export function VerifyEmailForm() {
	const { mutateAsync: resendVerificationEmail } = useResendVerificationEmail();
	const form = useAppForm({
		...verifyEmailFormOptions(),
		onSubmit: async ({ value }) => {
			await resendVerificationEmail(value);
		},
	});

	return (
		<form
			method="post"
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<form.AppField
				name="email"
				children={(field) => (
					<field.TextField
						label={m.common_email_label()}
						placeholder={m.common_email_placeholder()}
						type="email"
					/>
				)}
			/>
			<form.AppForm>
				<form.SubmitButton
					label={m.auth_verify_email_form_submit_button()}
					className="w-full"
				/>
			</form.AppForm>
		</form>
	);
}
