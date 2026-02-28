import { useAppForm } from "@/hooks/form";
import {
	useCreateOrganizationMutation,
	useUpdateOrganizationMutation,
} from "@/hooks/mutations/use-organization-mutations";
import type { Organization } from "@/lib/orpc/schemas/organization";
import { organizationFormOptions } from "./organization-form-options";

export const OrganizationForm = ({
	action,
	organization,
}: {
	action: "create" | "update";
	organization?: Organization;
}) => {
	const { mutate: createOrganization } = useCreateOrganizationMutation();
	const { mutate: updateOrganization } = useUpdateOrganizationMutation();

	const form = useAppForm({
		...organizationFormOptions,
		onSubmit: ({ value }) => {
			if (action === "update" && organization) {
				updateOrganization({ ...value, id: organization.id });
			} else {
				createOrganization(value);
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="flex flex-col gap-4"
		>
			<form.AppField
				name="name"
				children={(field) => (
					<field.TextField
						label="Organisation Name"
						placeholder="Your Organisation"
					/>
				)}
			/>
			<form.AppField
				name="slug"
				children={(field) => (
					<field.TextField label="Slug" placeholder="your-organisation" />
				)}
			/>
			<form.AppForm>
				<form.SubmitButton label="Save Organisation" />
			</form.AppForm>
		</form>
	);
};
