import { useAppForm } from "@/hooks/form";
import { useSignin } from "@/hooks/mutations/use-signin";
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
