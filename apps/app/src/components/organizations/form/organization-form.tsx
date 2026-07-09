import type { Organization } from "@orcai/schema";
import { useAppForm } from "@/hooks/form";
import {
	useCreateOrganizationMutation,
	useUpdateOrganizationMutation,
} from "@/hooks/mutations/use-organization-mutations";
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
		defaultValues: organization
			? {
					name: organization.name,
					slug: organization.slug,
				}
			: organizationFormOptions.defaultValues,
		onSubmit: ({ value }) => {
			if (action === "update" && organization) {
				updateOrganization({
					...value,
					id: organization.id,
				});
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

			<div className="flex justify-end pt-4">
				<form.AppForm>
					<form.SubmitButton label="Save Organisation" />
				</form.AppForm>
			</div>
		</form>
	);
};
