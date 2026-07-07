import { useAppForm } from "@/hooks/form";
import { useForgotPassword } from "@/hooks/mutations/use-forgot-password";
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
						label="Email"
						placeholder="your@email.com"
						type="email"
					/>
				)}
			/>
			<form.AppForm>
				<form.SubmitButton label="Send reset email" className="w-full" />
			</form.AppForm>
		</form>
	);
}
