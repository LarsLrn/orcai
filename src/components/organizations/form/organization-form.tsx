import { useAppForm } from "@/hooks/form";
import type { Organization } from "@/lib/orpc/schemas/organization";
import { organizationFormOptions } from "./organization-form-options";
import { useOrganizationFormSubmission } from "./use-organization-submission";

export const OrganizationForm = ({
	action,
	organization,
}: {
	action: "create" | "update";
	organization?: Organization;
}) => {
	const { create, update } = useOrganizationFormSubmission();

	const form = useAppForm({
		...organizationFormOptions,
		onSubmit: ({ value }) => {
			if (action === "update" && organization) {
				update({ ...value, id: organization.id });
			} else {
				create(value);
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
