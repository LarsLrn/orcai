import { useAppForm } from "@/hooks/form";
import { useChangePasswordMutation } from "@/hooks/mutations/use-change-password-mutation";
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
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<form.AppField
				name="currentPassword"
				children={(field) => (
					<field.PasswordField
						label="Current Password"
						placeholder="Enter current password"
					/>
				)}
			/>

			<form.AppField
				name="password"
				children={(field) => (
					<field.PasswordField
						label="New Password"
						placeholder="Enter new password"
					/>
				)}
			/>

			<form.AppField
				name="confirmPassword"
				children={(field) => (
					<field.PasswordField
						label="Confirm New Password"
						placeholder="Confirm new password"
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label="Change Password" />
			</form.AppForm>
		</form>
	);
};

export { ChangePasswordForm };
