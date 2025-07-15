"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormInputField } from "@/components/forms/fields/formInputField";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import type { Organization } from "@/db/schema/auth";
import {
	type OrganizationInsertSchemaType,
	organizationInsertSchema,
} from "@/db/zod/organization";
import { authClient } from "@/lib/auth-client";

const OrganizationForm = ({
	organization,
}: {
	organization?: Organization;
}) => {
	const navigate = useNavigate();

	const form = useForm<OrganizationInsertSchemaType>({
		resolver: zodResolver(organizationInsertSchema),
		defaultValues: {
			name: organization?.name ?? undefined,
			slug: organization?.slug ?? undefined,
		},
	});

	const onSubmit = async (values: OrganizationInsertSchemaType) => {
		if (organization) {
			toast.promise(
				authClient.organization.update({
					data: {
						name: values.name,
						slug: values.slug,
						// logo: "new-logo.url",
						// metadata: {},
					},
					organizationId: organization.id,
				}),
				{
					loading: "Updating organisation...",
					success: () => {
						navigate({
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
				authClient.organization.create({
					name: values.name,
					slug: values.slug,
					// logo: "https://example.com/logo.png",
				}),
				{
					loading: "Creating organisation...",
					success: (result) => {
						const orgId = result.data?.id;

						if (!orgId) {
							throw new Error("Organization ID is missing in the response");
						}

						navigate({
							to: "/app/orgs/$orgId",
							params: { orgId },
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
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormInputField
							field={field}
							label="Organisation Name"
							placeholder="Your organisation"
							inputType="text"
						/>
					)}
				/>
				<FormField
					control={form.control}
					name="slug"
					render={({ field }) => (
						<FormInputField
							field={field}
							label="Organisation Slug"
							placeholder="your-organisation"
							inputType="text"
						/>
					)}
				/>
				<Button type="submit">Save Organisation</Button>
			</form>
		</Form>
	);
};

export { OrganizationForm };
