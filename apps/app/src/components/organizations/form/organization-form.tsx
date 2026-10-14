import type { Organization } from "@orcai/schema";
import { useAppForm } from "@/hooks/form";
import {
	useCreateOrganizationMutation,
	useUpdateOrganizationMutation,
} from "@/hooks/mutations/use-organization-mutations";
import { m } from "@/paraglide/messages";
import { organizationFormOptions } from "./organization-form-options";

type OrganizationFormProps = {
	onCompleted?: () => void;
} & (
	| {
			action: "create";
			organization?: never;
	  }
	| {
			action: "update";
			organization: Organization;
	  }
);

export const OrganizationForm = ({
	action,
	organization,
	onCompleted,
}: OrganizationFormProps) => {
	const { mutateAsync: createOrganization } = useCreateOrganizationMutation({
		onSuccess: onCompleted,
	});
	const { mutateAsync: updateOrganization } = useUpdateOrganizationMutation({
		onSuccess: onCompleted,
	});

	const form = useAppForm({
		...organizationFormOptions,
		defaultValues: organization
			? {
					name: organization.name,
					slug: organization.slug,
				}
			: organizationFormOptions.defaultValues,
		onSubmit: async ({ value }) => {
			if (action === "update") {
				await updateOrganization({
					...value,
					id: organization.id,
				});
			} else {
				await createOrganization(value);
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
						label={m.orgs_form_name_label()}
						placeholder={m.orgs_form_name_placeholder()}
					/>
				)}
			/>
			<form.AppField
				name="slug"
				children={(field) => (
					<field.TextField
						label={m.orgs_form_slug_label()}
						placeholder={m.orgs_form_slug_placeholder()}
					/>
				)}
			/>

			<div className="flex justify-end pt-4">
				<form.AppForm>
					<form.SubmitButton label={m.orgs_form_submit_button()} />
				</form.AppForm>
			</div>
		</form>
	);
};
