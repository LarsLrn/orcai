import { useAppForm } from "@/hooks/form";
import { useSignin } from "@/hooks/mutations/use-signin";
import { m } from "@/paraglide/messages";
import { signinFormOptions } from "./signin-form-options";

const SignInForm = () => {
	const { mutate: signin } = useSignin();

	const form = useAppForm({
		...signinFormOptions(),
		onSubmit: ({ value }) => {
			signin(value);
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
				name="email"
				children={(field) => (
					<field.TextField
						label={m.common_email_label()}
						placeholder={m.common_email_placeholder()}
					/>
				)}
			/>

			<form.AppField
				name="password"
				children={(field) => (
					<field.PasswordField
						label={m.common_password_label()}
						placeholder={m.common_password_placeholder()}
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton
					label={m.auth_signin_form_submit_button()}
					className="w-full"
				/>
			</form.AppForm>
		</form>
	);
};

export { SignInForm };
