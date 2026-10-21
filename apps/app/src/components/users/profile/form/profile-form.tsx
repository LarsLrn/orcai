import { useRouteContext } from "@tanstack/react-router";
import { profileFormOptions } from "@/components/users/profile/form/profile-form-options";
import { useAppForm } from "@/hooks/form";
import { useUpdateProfileMutation } from "@/hooks/mutations/use-profile-mutations";
import { m } from "@/paraglide/messages";

const ProfileForm = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { mutateAsync: updateProfile } = useUpdateProfileMutation();

	const form = useAppForm({
		...profileFormOptions(auth.user.name),
		onSubmit: async ({ value }) => {
			await updateProfile(value);
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
					<field.TextField
						label={m.users_profile_form_name_label()}
						placeholder={m.users_profile_form_name_placeholder()}
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label={m.users_profile_form_submit_button()} />
			</form.AppForm>
		</form>
	);
};

export { ProfileForm };
