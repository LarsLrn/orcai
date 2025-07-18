import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type z from "zod/v4";
import { FormInputField } from "@/components/forms/fields/formInputField";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import type { Organization } from "@/db/schema/organization";
import { organizationInsertSchema } from "@/lib/orpc/contracts/organization";
import { orpc } from "@/lib/orpc/orpc";

const OrganizationForm = ({
	organization,
}: {
	organization?: Organization;
}) => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { mutateAsync: updateOrganization } = useMutation(
		orpc.organization.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organization.list.key(),
				});
			},
		}),
	);

	const { mutateAsync: createOrganization } = useMutation(
		orpc.organization.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.organization.list.key(),
				});
			},
		}),
	);

	const form = useForm<z.infer<typeof organizationInsertSchema>>({
		resolver: zodResolver(organizationInsertSchema),
		defaultValues: {
			name: organization?.name ?? undefined,
			slug: organization?.slug ?? undefined,
		},
	});

	const onSubmit = async (values: z.infer<typeof organizationInsertSchema>) => {
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
				createOrganization({
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
