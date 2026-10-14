import { useAppForm } from "@/hooks/form";
import { useForgotPassword } from "@/hooks/mutations/use-forgot-password";
import { m } from "@/paraglide/messages";
import { forgotPasswordFormOptions } from "./forgot-password-form-options";

export function ForgotPasswordForm() {
	const { mutate: requestPasswordReset } = useForgotPassword();
	const form = useAppForm({
		...forgotPasswordFormOptions(),
		onSubmit: ({ value }) => {
			requestPasswordReset(value);
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
					label={m.auth_forgot_password_form_submit_button()}
					className="w-full"
				/>
			</form.AppForm>
		</form>
	);
}
