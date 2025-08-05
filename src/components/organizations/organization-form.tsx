import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/form-input-field";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import type { Organization } from "@/db/schema/organization";
import {
	type OrganizationInsert,
	organizationInsertSchema,
} from "@/lib/orpc/schemas/organization";
import { organizationQueryOptions } from "@/lib/query-options/organization";

const OrganizationForm = ({
	organization,
}: {
	organization?: Organization;
}) => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { mutateAsync: updateOrganization } = useMutation(
		organizationQueryOptions.update(queryClient),
	);

	const { mutateAsync: createOrganization } = useMutation(
		organizationQueryOptions.create(queryClient),
	);

	const form = useForm<OrganizationInsert>({
		resolver: zodResolver(organizationInsertSchema),
		defaultValues: {
			name: organization?.name ?? undefined,
			slug: organization?.slug ?? undefined,
		},
	});

	const onSubmit = (values: OrganizationInsert) => {
		if (organization) {
			toast.promise(
				updateOrganization({
					name: values.name,
					slug: values.slug,
					// logo: "new-logo.url",
					// metadata: {}
					id: organization.id,
				}),
				{
					loading: "Updating organisation...",
					success: async () => {
						await navigate({
							to: "/app/orgs/$orgId",
							params: { orgId: organization.id },
						});
						return "Organisation updated successfully";
					},
					error: (error) => ({
						message: "Failed to update organisation",
						description: error.message,
					}),
				},
			);
		} else {
			toast.promise(
				createOrganization({
					name: values.name,
					slug: values.slug,
					// logo: "https://example.com/logo.png",
				}),
				{
					loading: "Creating organisation...",
					success: async (result) => {
						await navigate({
							to: "/app/orgs/$orgId",
							params: { orgId: result.data.id },
						});
						return "Organisation created successfully";
					},
					error: (error) => ({
						message: "Failed to create organisation",
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
				<FormInputField
					form={form}
					name="name"
					label="Organisation Name"
					placeholder="Your organisation"
					inputType="text"
				/>
				<FormInputField
					form={form}
					name="slug"
					label="Organisation Slug"
					placeholder="your-organisation"
					inputType="text"
				/>
				<Button type="submit">Save Organisation</Button>
			</form>
		</Form>
	);
};

export { OrganizationForm };
