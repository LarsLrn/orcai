import { useAppForm } from "@/hooks/form";
import { signinFormOptions } from "./signin-form-options";
import { useSigninSubmission } from "./use-signin";

const SignInForm = () => {
	const submit = useSigninSubmission();

	const form = useAppForm({
		...signinFormOptions(),
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
				name="email"
				children={(field) => (
					<field.TextField label="Email" placeholder="your@email.com" />
				)}
			/>

			<form.AppField
				name="password"
				children={(field) => (
					<field.PasswordField label="Password" placeholder="Password" />
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label="Login" className="w-full" />
			</form.AppForm>
		</form>
	);
};

export { SignInForm };
