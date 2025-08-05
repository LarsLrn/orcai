import { zodResolver } from "@hookform/resolvers/zod";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormPasswordField } from "@/components/forms/fields/form-password-field";
import { FormSelectField } from "@/components/forms/fields/form-select-field";
import { FormSwitchField } from "@/components/forms/fields/form-switch-field";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
	type OrganizationProvider,
	type OrganizationProviderInsert,
	organizationProviderInsertSchema,
} from "@/lib/orpc/schemas/organization-provider";
import { organizationProviderQueryOptions } from "@/lib/query-options/organization-provider";
import { providerQueryOptions } from "@/lib/query-options/provider";

const OrganizationProviderForm = ({
	organizationId,
	organizationProvider,
}: {
	organizationId: string;
	organizationProvider?: OrganizationProvider;
}) => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: providers } = useSuspenseQuery(providerQueryOptions.list());

	const { mutateAsync: updateProvider } = useMutation(
		organizationProviderQueryOptions.update(queryClient),
	);

	const { mutateAsync: createProvider } = useMutation(
		organizationProviderQueryOptions.create(queryClient),
	);

	const form = useForm<OrganizationProviderInsert>({
		resolver: zodResolver(organizationProviderInsertSchema),
		defaultValues: {
			organizationId,
			providerSlug: organizationProvider?.providerSlug ?? undefined,
			apiKey: organizationProvider?.apiKeyEncrypted ?? undefined,
			enabled: organizationProvider?.enabled ?? true,
		},
	});

	const onSubmit = (values: OrganizationProviderInsert) => {
		if (organizationProvider) {
			toast.promise(
				updateProvider({
					organizationId: values.organizationId,
					providerSlug: values.providerSlug,
					apiKey: values.apiKey,
					enabled: values.enabled,
				}),
				{
					loading: "Updating provider...",
					success: async () => {
						await navigate({
							to: "/app/orgs/$orgId/providers/$providerSlug",
							params: {
								orgId: organizationId,
								providerSlug: values.providerSlug,
							},
						});
						return "Provider updated successfully";
					},
					error: (error) => ({
						message: "Failed to update provider",
						description: error.message,
					}),
				},
			);
		} else {
			toast.promise(
				createProvider({
					organizationId: values.organizationId,
					providerSlug: values.providerSlug,
					apiKey: values.apiKey,
					enabled: values.enabled,
				}),
				{
					loading: "Creating provider...",
					success: async (result) => {
						await navigate({
							to: "/app/orgs/$orgId/providers/$providerSlug",
							params: {
								orgId: organizationId,
								providerSlug: result.data.providerSlug,
							},
						});
						return "Provider created successfully";
					},
					error: (error) => ({
						message: "Failed to create provider",
						description: error.message,
					}),
				},
			);
		}
	};

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="flex flex-col gap-4"
			>
				<FormSelectField
					form={form}
					name="providerSlug"
					label="Provider"
					placeholder="Select a provider"
					options={providers.data.map((provider) => ({
						value: provider.slug,
						label: provider.name,
					}))}
					disabled={!!organizationProvider} // Don't allow changing provider on edit
				/>
				<FormPasswordField
					form={form}
					name="apiKey"
					label="API Key"
					placeholder="Enter your API key"
				/>
				<FormSwitchField
					form={form}
					name="enabled"
					label="Enabled"
					description="Enable this provider for use in the organization"
				/>
				<Button type="submit">
					{organizationProvider ? "Update Provider" : "Add Provider"}
				</Button>
			</form>
		</Form>
	);
};

export { OrganizationProviderForm };
