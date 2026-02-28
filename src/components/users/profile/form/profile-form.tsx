import { useRouteContext } from "@tanstack/react-router";
import { profileFormOptions } from "@/components/users/profile/form/profile-form-options";
import { useAppForm } from "@/hooks/form";
import { useUpdateProfileMutation } from "@/hooks/mutations/use-profile-mutations";
import type { User } from "@/lib/orpc/schemas/user";

const ProfileForm = () => {
	const { auth } = useRouteContext({ from: "/app" });
	const { mutate: updateProfile } = useUpdateProfileMutation();

	const form = useAppForm({
		// TODO: Improve type after refactoring schemas
		...profileFormOptions(auth.user as Omit<User, "preferences">),
		onSubmit: ({ value }) => {
			updateProfile({ name: value.name ?? "" }); // FIXME: Check why name can be undefined
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
				<form.SubmitButton label="Save Profile" />
			</form.AppForm>
		</form>
	);
};

export { ProfileForm };
