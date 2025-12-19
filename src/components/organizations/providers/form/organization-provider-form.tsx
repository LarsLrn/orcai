import { useSuspenseQuery } from "@tanstack/react-query";
import { useAppForm } from "@/hooks/form";
import { orpc } from "@/lib/orpc/orpc";
import type { OrganizationProvider } from "@/lib/orpc/schemas/organization-provider";
import { organizationProviderFormOptions } from "./organization-provider-form-options";
import { useOrganizationProviderFormSubmission } from "./use-organization-provider-submission";

const OrganizationProviderForm = ({
	action,
	organizationProvider,
}: {
	action: "create" | "update";
	organizationProvider?: OrganizationProvider;
}) => {
	const { data: providers } = useSuspenseQuery(
		orpc.provider.list.queryOptions(),
	);

	const { create, update } = useOrganizationProviderFormSubmission();

	const form = useAppForm({
		...organizationProviderFormOptions(organizationProvider),
		onSubmit: ({ value }) => {
			if (action === "update" && organizationProvider) {
				update({
					...value,
				});
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
				name="providerSlug"
				children={(field) => (
					<field.SelectField
						label="Provider"
						placeholder="Select a provider"
						options={providers.data.map((provider) => ({
							value: provider.slug,
							label: provider.name,
						}))}
						disabled={action === "update"} // Don't allow changing provider on edit
					/>
				)}
			/>

			<form.AppField
				name="apiKey"
				children={(field) => (
					<field.PasswordField
						label="API Key"
						placeholder="Enter your API key"
					/>
				)}
			/>

			<form.AppField
				name="enabled"
				children={(field) => (
					<field.SwitchField
						label="Enabled"
						description="Enable this provider for use in the organization"
					/>
				)}
			/>

			<form.AppForm>
				<form.SubmitButton label="Save Provider" />
			</form.AppForm>
		</form>
	);
};

export { OrganizationProviderForm };
