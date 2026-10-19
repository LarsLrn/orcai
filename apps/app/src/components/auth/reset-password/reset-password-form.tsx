import { useAppForm } from "@/hooks/form";
import { useResetPassword } from "@/hooks/mutations/use-reset-password";
import { m } from "@/paraglide/messages";
import { resetPasswordFormOptions } from "./reset-password-form-options";

export function ResetPasswordForm({ token }: { token: string }) {
	const { mutateAsync: resetPassword } = useResetPassword(token);
	const form = useAppForm({
		...resetPasswordFormOptions(),
		onSubmit: async ({ value }) => {
			await resetPassword(value);
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
				name="password"
				children={(field) => (
					<field.PasswordField
						label={m.auth_reset_password_form_new_password_label()}
						placeholder={m.auth_reset_password_form_new_password_placeholder()}
						showStrength
					/>
				)}
			/>
			<form.AppField
				name="confirmPassword"
				children={(field) => (
					<field.PasswordField
						label={m.auth_reset_password_form_confirm_password_label()}
						placeholder={m.auth_reset_password_form_confirm_password_placeholder()}
					/>
				)}
			/>
			<form.AppForm>
				<form.SubmitButton
					label={m.auth_reset_password_form_submit_button()}
					className="w-full"
				/>
			</form.AppForm>
		</form>
	);
}
