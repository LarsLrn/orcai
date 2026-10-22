import { twoFactorPasswordSchema } from "@orcai/schema";
import { useRouter } from "@tanstack/react-router";
import { ShieldCheckIcon, ShieldOffIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAppForm } from "@/hooks/form";
import {
	useDisableTwoFactorMutation,
	useGenerateBackupCodesMutation,
} from "@/hooks/mutations/use-two-factor-mutations";
import { m } from "@/paraglide/messages";
import { BackupCodes } from "./backup-codes";
import { TwoFactorEnrolment } from "./two-factor-enrolment";

/** A password prompt for one 2FA change Better Auth guards with the password. */
const PasswordAction = ({
	submitLabel,
	onSubmit,
	onCancel,
}: {
	submitLabel: string;
	onSubmit: (password: string) => Promise<unknown>;
	onCancel: () => void;
}) => {
	const form = useAppForm({
		defaultValues: {
			password: "",
		},
		validators: {
			onChange: twoFactorPasswordSchema,
		},
		onSubmit: ({ value }) => onSubmit(value.password),
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
				name="password"
				children={(field) => (
					<field.PasswordField label={m.common_password_label()} />
				)}
			/>
			<div className="flex gap-2">
				<form.AppForm>
					<form.SubmitButton label={submitLabel} />
				</form.AppForm>
				<Button type="button" variant="ghost" onClick={onCancel}>
					{m.common_cancel_button()}
				</Button>
			</div>
		</form>
	);
};

type Mode =
	| {
			mode: "idle";
	  }
	| {
			mode: "enrol";
	  }
	| {
			mode: "regenerate";
	  }
	| {
			mode: "codes";
			codes: string[];
	  }
	| {
			mode: "disable";
	  };

/** Two-factor authentication for the signed-in user: enrol, new backup codes, turn off. */
export const TwoFactorCard = ({
	enabled,
	enforced,
}: {
	enabled: boolean;
	/** The operator's policy covers the user, so turning it off is not offered. */
	enforced: boolean;
}) => {
	const router = useRouter();
	const [state, setState] = useState<Mode>({
		mode: "idle",
	});
	const idle = () =>
		setState({
			mode: "idle",
		});
	const { mutateAsync: generateBackupCodes } = useGenerateBackupCodesMutation();
	const { mutateAsync: disable } = useDisableTwoFactorMutation();

	const content = () => {
		switch (state.mode) {
			case "enrol":
				return (
					<TwoFactorEnrolment
						onDone={() => {
							idle();
							router.invalidate();
						}}
					/>
				);
			case "regenerate":
				return (
					<PasswordAction
						submitLabel={m.two_factor_regenerate_button()}
						onCancel={idle}
						onSubmit={async (password) => {
							const result = await generateBackupCodes({
								password,
							});
							if (result.status === "success")
								setState({
									mode: "codes",
									codes: result.data,
								});
						}}
					/>
				);
			case "codes":
				return (
					<div className="flex flex-col gap-4">
						<BackupCodes codes={state.codes} />
						<Button type="button" className="self-start" onClick={idle}>
							{m.two_factor_enrolment_done_button()}
						</Button>
					</div>
				);
			case "disable":
				return (
					<PasswordAction
						submitLabel={m.two_factor_disable_button()}
						onCancel={idle}
						onSubmit={async (password) => {
							const result = await disable({
								password,
							});
							if (result.status === "success") idle();
						}}
					/>
				);
			case "idle":
				return enabled ? (
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							onClick={() =>
								setState({
									mode: "regenerate",
								})
							}
						>
							{m.two_factor_regenerate_button()}
						</Button>
						{!enforced && (
							<Button
								variant="outline"
								onClick={() =>
									setState({
										mode: "disable",
									})
								}
							>
								{m.two_factor_disable_button()}
							</Button>
						)}
					</div>
				) : (
					<Button
						className="self-start"
						onClick={() =>
							setState({
								mode: "enrol",
							})
						}
					>
						{m.two_factor_enable_button()}
					</Button>
				);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.two_factor_card_title()}</CardTitle>
				<CardDescription className="flex items-center gap-2">
					{enabled ? (
						<ShieldCheckIcon className="h-4 w-4 text-green-600" />
					) : (
						<ShieldOffIcon className="h-4 w-4 text-muted-foreground" />
					)}
					{enabled
						? m.two_factor_card_enabled_description()
						: m.two_factor_card_disabled_description()}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">{content()}</CardContent>
		</Card>
	);
};
