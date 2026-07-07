import { useAppForm } from "@/hooks/form";
import { useResendVerificationEmail } from "@/hooks/mutations/use-resend-verification-email";
import { verifyEmailFormOptions } from "./verify-email-form-options";

export function VerifyEmailForm() {
	const { mutate: resendVerificationEmail } = useResendVerificationEmail();
	const form = useAppForm({
		...verifyEmailFormOptions(),
		onSubmit: ({ value }) => {
			resendVerificationEmail(value);
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
				<form.SubmitButton
					label="Resend verification email"
					className="w-full"
				/>
			</form.AppForm>
		</form>
	);
}
