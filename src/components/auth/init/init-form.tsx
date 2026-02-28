import { Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAppForm } from "@/hooks/form";
import { useInit } from "@/hooks/mutations/use-init";
import { initFormOptions } from "./init-form-options";

const InitForm = () => {
	const { mutate: init } = useInit();
	const form = useAppForm({
		...initFormOptions(),
		onSubmit: ({ value }) => {
			init(value);
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-4"
			noValidate
		>
			<form.AppField
				name="organizationName"
				children={(field) => (
					<field.TextField
						label="Organisation Name"
						placeholder="Your Organisation"
					/>
				)}
			/>

			<form.AppField
				name="organizationSlug"
				children={(field) => (
					<field.TextField label="Organisation Slug" placeholder="your-org" />
				)}
			/>

			<form.AppField
				name="name"
				children={(field) => (
					<field.TextField label="Owner Name" placeholder="Your Name" />
				)}
			/>

			<form.AppField
				name="email"
				children={(field) => (
					<field.TextField
						label="Owner Email"
						placeholder="your@email.com"
						type="email"
					/>
				)}
			/>

			<form.AppField
				name="password"
				children={(field) => (
					<field.PasswordField
						label="Password"
						placeholder="Password"
						showStrength
					/>
				)}
			/>

			<form.AppField
				name="confirmPassword"
				children={(field) => (
					<field.PasswordField
						label="Confirm Password"
						placeholder="Confirm Password"
					/>
				)}
			/>

			<div className="space-y-4 rounded-lg border bg-background/50 p-4 shadow-sm">
				<div className="space-y-2">
					<h3 className="font-semibold">Privacy Policy</h3>
					<p className="text-muted-foreground text-sm">
						By initializing this instance, you agree to our Privacy Policy and
						Terms of Use.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Link
						className={buttonVariants({
							variant: "outline",
							size: "sm",
						})}
						to={"/privacy"}
					>
						<FileTextIcon /> Review Privacy Policy
					</Link>
					<Link
						className={buttonVariants({
							variant: "outline",
							size: "sm",
						})}
						to={"/tou"}
					>
						<FileTextIcon /> Review Terms of Use
					</Link>
				</div>

				<form.AppField
					name="privacyConsent"
					children={(field) => (
						<field.SwitchField
							label="Privacy Consent"
							description="Yes, I have read, understood, and agree to the privacy policy and terms of use of the Sokratesᵗ platform."
						/>
					)}
				/>
			</div>

			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<form.AppForm>
				<form.SubmitButton label="Initialize Instance" className="w-full" />
			</form.AppForm>
		</form>
	);
};

export { InitForm };
