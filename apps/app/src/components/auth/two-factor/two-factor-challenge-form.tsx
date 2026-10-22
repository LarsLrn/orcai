import { twoFactorChallengeSchema } from "@orcai/schema";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppForm } from "@/hooks/form";
import { useTwoFactorChallengeMutation } from "@/hooks/mutations/use-two-factor-mutations";
import { m } from "@/paraglide/messages";

/** The second sign-in step: an authenticator code, or a backup code instead. */
export const TwoFactorChallengeForm = () => {
	const [method, setMethod] = useState<"totp" | "backup">("totp");
	const { mutateAsync: verify } = useTwoFactorChallengeMutation(method);
	const form = useAppForm({
		defaultValues: {
			code: "",
			trustDevice: false,
		},
		validators: {
			onChange: twoFactorChallengeSchema,
		},
		onSubmit: async ({ value }) => {
			await verify(value);
		},
	});

	return (
		<form
			method="post"
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-4"
		>
			<form.AppField
				key={method}
				name="code"
				children={(field) =>
					method === "totp" ? (
						<field.CodeField label={m.two_factor_code_label()} autoFocus />
					) : (
						<field.TextField
							label={m.two_factor_backup_code_label()}
							autoComplete="off"
							autoFocus
						/>
					)
				}
			/>
			<form.AppField
				name="trustDevice"
				children={(field) => (
					<field.CheckboxField label={m.two_factor_trust_device_label()} />
				)}
			/>
			<form.AppForm>
				<form.SubmitButton
					label={m.two_factor_challenge_submit_button()}
					className="w-full"
				/>
			</form.AppForm>
			<Button
				type="button"
				variant="link"
				onClick={() => {
					form.setFieldValue("code", "");
					setMethod(method === "totp" ? "backup" : "totp");
				}}
			>
				{method === "totp"
					? m.two_factor_use_backup_code_button()
					: m.two_factor_use_authenticator_button()}
			</Button>
		</form>
	);
};
