import { useRouteContext } from "@tanstack/react-router";
import { profileFormOptions } from "@/components/users/profile/form/profile-form-options";
import { useProfileFormSubmission } from "@/components/users/profile/form/use-profile-submission";
import { useAppForm } from "@/hooks/form";

const ProfileForm = () => {
	const { auth } = useRouteContext({ from: "/app" });
	const { update } = useProfileFormSubmission();

	const form = useAppForm({
		...profileFormOptions(auth.user),
		onSubmit: ({ value }) => {
			update({ name: value.name ?? "" }); // FIXME: Check why name can be undefined
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
			<form.AppForm>
				<form.FormValidationErrors />
			</form.AppForm>

			<form.AppField
				name="name"
				children={(field) => (
					<field.TextField label="Name" placeholder="Your name" />
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label="Save Block" />
			</form.AppForm>
		</form>
	);
};

export { ProfileForm };
