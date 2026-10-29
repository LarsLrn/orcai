import { useAppForm } from "@/hooks/form";
import { useChangePasswordMutation } from "@/hooks/mutations/use-change-password-mutation";
import { m } from "@/paraglide/messages";
import { changePasswordFormOptions } from "./change-password-form-options";

const ChangePasswordForm = () => {
	const { mutateAsync: changePassword } = useChangePasswordMutation();

	const form = useAppForm({
		...changePasswordFormOptions(),
		onSubmit: async ({ value, formApi }) => {
			const result = await changePassword(value);

			if (result.status === "success") {
				formApi.reset();
			}
		},
	});

	return (
		<form
			method="post"
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-5"
		>
			<form.AppField
				name="currentPassword"
				children={(field) => (
					<field.PasswordField
						label={m.auth_change_password_form_current_password_label()}
						placeholder={m.auth_change_password_form_current_password_placeholder()}
						width="medium"
					/>
				)}
			/>

			<form.AppField
				name="password"
				children={(field) => (
					<field.PasswordField
						label={m.auth_change_password_form_new_password_label()}
						placeholder={m.auth_change_password_form_new_password_placeholder()}
						width="medium"
					/>
				)}
			/>

			<form.AppField
				name="confirmPassword"
				children={(field) => (
					<field.PasswordField
						label={m.auth_change_password_form_confirm_password_label()}
						placeholder={m.auth_change_password_form_confirm_password_placeholder()}
						width="medium"
					/>
				)}
			/>

			<div className="flex justify-end">
				<form.AppForm>
					<form.SubmitButton
						label={m.auth_change_password_form_submit_button()}
					/>
				</form.AppForm>
			</div>
		</form>
	);
};

export { ChangePasswordForm };
