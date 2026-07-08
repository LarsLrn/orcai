import { useAppForm } from "@/hooks/form";
import { useResetPassword } from "@/hooks/mutations/use-reset-password";
import { resetPasswordFormOptions } from "./reset-password-form-options";

export function ResetPasswordForm({ token }: { token: string }) {
	const { mutate: resetPassword } = useResetPassword(token);
	const form = useAppForm({
		...resetPasswordFormOptions(),
		onSubmit: ({ value }) => {
			resetPassword(value);
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
						label="New Password"
						placeholder="New password"
						showStrength
					/>
				)}
			/>
			<form.AppField
				name="confirmPassword"
				children={(field) => (
					<field.PasswordField
						label="Confirm Password"
						placeholder="Confirm password"
					/>
				)}
			/>
			<form.AppForm>
				<form.SubmitButton label="Reset password" className="w-full" />
			</form.AppForm>
		</form>
	);
}
