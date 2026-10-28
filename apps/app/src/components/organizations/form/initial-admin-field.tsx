import type { InstanceUser } from "@orcai/schema";
import { useId, useState } from "react";
import { InstanceUserPicker } from "@/components/instance/instance-user-picker";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { m } from "@/paraglide/messages";

type InitialAdminKind = "me" | "user" | "invite";

const options: {
	kind: InitialAdminKind;
	title: () => string;
	description: () => string;
}[] = [
	{
		kind: "me",
		title: m.orgs_form_initial_admin_me_label,
		description: m.orgs_form_initial_admin_me_description,
	},
	{
		kind: "user",
		title: m.orgs_form_initial_admin_user_label,
		description: m.orgs_form_initial_admin_user_description,
	},
	{
		kind: "invite",
		title: m.orgs_form_initial_admin_invite_label,
		description: m.orgs_form_initial_admin_invite_description,
	},
];

/** Who administers a new organisation: me, an existing account, or an invitee. */
export const InitialAdminField = ({
	kind,
	onKindChange,
	onUserChange,
	email,
	onEmailChange,
	userError,
	emailError,
}: {
	kind: InitialAdminKind;
	onKindChange: (kind: InitialAdminKind) => void;
	onUserChange: (userId: string | null) => void;
	email: string;
	onEmailChange: (email: string) => void;
	userError?: string;
	emailError?: string;
}) => {
	const id = useId();
	const [user, setUser] = useState<InstanceUser | null>(null);

	return (
		<div className="flex min-w-0 flex-col gap-3">
			<p id={`${id}-label`} className="font-medium text-sm">
				{m.orgs_form_initial_admin_label()}
			</p>
			<RadioGroup
				aria-labelledby={`${id}-label`}
				value={kind}
				onValueChange={(next) => onKindChange(next as InitialAdminKind)}
				className="gap-2"
			>
				{options.map((option) => {
					const itemId = `${id}-${option.kind}`;
					return (
						<FieldLabel key={option.kind} htmlFor={itemId}>
							<Field orientation="horizontal">
								<RadioGroupItem value={option.kind} id={itemId} />
								<FieldContent>
									<FieldTitle>{option.title()}</FieldTitle>
									<FieldDescription>{option.description()}</FieldDescription>
								</FieldContent>
							</Field>
						</FieldLabel>
					);
				})}
			</RadioGroup>
			{kind === "user" && (
				<Field className="min-w-0">
					<InstanceUserPicker
						value={user}
						onChange={(next) => {
							setUser(next);
							onUserChange(next?.id ?? null);
						}}
					/>
					{userError && <FieldError>{userError}</FieldError>}
				</Field>
			)}
			{kind === "invite" && (
				<Field>
					<FieldLabel htmlFor={`${id}-email`}>
						{m.orgs_form_initial_admin_email_label()}
					</FieldLabel>
					<Input
						id={`${id}-email`}
						type="email"
						value={email}
						onChange={(event) => onEmailChange(event.target.value)}
						aria-invalid={emailError ? true : undefined}
					/>
					{emailError && <FieldError>{emailError}</FieldError>}
				</Field>
			)}
		</div>
	);
};
