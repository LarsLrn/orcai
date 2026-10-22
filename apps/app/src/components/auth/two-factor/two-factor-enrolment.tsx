import { totpCodeSchema, twoFactorPasswordSchema } from "@orcai/schema";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAppForm } from "@/hooks/form";
import {
	useConfirmTwoFactorMutation,
	useEnableTwoFactorMutation,
} from "@/hooks/mutations/use-two-factor-mutations";
import { m } from "@/paraglide/messages";
import { BackupCodes } from "./backup-codes";
import { TotpQrCode } from "./totp-qr-code";

type Step =
	| {
			step: "password";
	  }
	| {
			step: "scan";
			totpURI: string;
			backupCodes: string[];
	  }
	| {
			step: "codes";
			backupCodes: string[];
	  };

const PasswordStep = ({
	onEnabled,
}: {
	onEnabled: (setup: { totpURI: string; backupCodes: string[] }) => void;
}) => {
	const { mutateAsync: enable } = useEnableTwoFactorMutation();
	const form = useAppForm({
		defaultValues: {
			password: "",
		},
		validators: {
			onChange: twoFactorPasswordSchema,
		},
		onSubmit: async ({ value }) => {
			const result = await enable(value);
			if (result.status === "success" && result.data.method === "totp")
				onEnabled(result.data);
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
			<p className="text-muted-foreground text-sm">
				{m.two_factor_enrolment_password_description()}
			</p>
			<form.AppField
				name="password"
				children={(field) => (
					<field.PasswordField label={m.common_password_label()} />
				)}
			/>
			<form.AppForm>
				<form.SubmitButton label={m.two_factor_enrolment_start_button()} />
			</form.AppForm>
		</form>
	);
};

const ScanStep = ({
	totpURI,
	onConfirmed,
}: {
	totpURI: string;
	onConfirmed: () => void;
}) => {
	const { mutateAsync: confirm } = useConfirmTwoFactorMutation();
	const secretId = useId();
	const secret = new URL(totpURI).searchParams.get("secret") ?? "";
	const form = useAppForm({
		defaultValues: {
			code: "",
		},
		validators: {
			onChange: totpCodeSchema,
		},
		onSubmit: async ({ value }) => {
			const result = await confirm(value);
			if (result.status === "success") onConfirmed();
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
			<p className="text-muted-foreground text-sm">
				{m.two_factor_enrolment_scan_description()}
			</p>
			<TotpQrCode uri={totpURI} label={m.two_factor_enrolment_qr_label()} />
			<Field>
				<FieldLabel htmlFor={secretId}>
					{m.two_factor_enrolment_secret_label()}
				</FieldLabel>
				<Input
					id={secretId}
					readOnly
					value={secret}
					className="font-mono"
					onFocus={(e) => e.currentTarget.select()}
				/>
			</Field>
			<form.AppField
				name="code"
				children={(field) => (
					<field.CodeField label={m.two_factor_code_label()} />
				)}
			/>
			<form.AppForm>
				<form.SubmitButton label={m.two_factor_enrolment_verify_button()} />
			</form.AppForm>
		</form>
	);
};

/** Enrols an authenticator app: password, QR code and a first code, then the backup codes once. */
export const TwoFactorEnrolment = ({ onDone }: { onDone: () => void }) => {
	const [state, setState] = useState<Step>({
		step: "password",
	});

	switch (state.step) {
		case "password":
			return (
				<PasswordStep
					onEnabled={(setup) =>
						setState({
							step: "scan",
							...setup,
						})
					}
				/>
			);
		case "scan":
			return (
				<ScanStep
					totpURI={state.totpURI}
					onConfirmed={() =>
						setState({
							step: "codes",
							backupCodes: state.backupCodes,
						})
					}
				/>
			);
		case "codes":
			return (
				<div className="flex flex-col gap-4">
					<BackupCodes codes={state.backupCodes} />
					<Button type="button" className="self-start" onClick={onDone}>
						{m.two_factor_enrolment_done_button()}
					</Button>
				</div>
			);
	}
};
