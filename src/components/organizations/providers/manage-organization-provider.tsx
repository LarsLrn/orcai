import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type z from "zod/v4";
import { Button } from "@/components/ui/button";
import type { organizationProviderSelectSchema } from "@/lib/orpc/contracts/organization-provider";
import { orpc } from "@/lib/orpc/orpc";
import { OrganizationProviderForm } from "./organization-provider-form";

type OrganizationProvider = z.infer<typeof organizationProviderSelectSchema>;

const ManageOrganizationProvider = ({
	organizationId,
	organizationProvider,
}: {
	organizationId: string;
	organizationProvider: OrganizationProvider;
}) => {
	const queryClient = useQueryClient();
	const { mutateAsync: deleteProvider } = useMutation(
		orpc.organizationProvider.delete.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: orpc.organizationProvider.list.key(),
				});
			},
		}),
	);

	const handleDeleteProvider = (provider: OrganizationProvider) => {
		toast.promise(
			deleteProvider({
				organizationId: provider.organizationId,
				refs: [{ providerSlug: provider.providerSlug }],
			}),
			{
				loading: "Deleting provider...",
				success: "Provider deleted",
				error: (error) => ({
					message: "Failed to delete provider",
					description: error.message,
				}),
			},
		);
	};

	return (
		<div className="mt-4 flex flex-col gap-4">
			<OrganizationProviderForm
				organizationId={organizationId}
				organizationProvider={organizationProvider}
			/>
			<div className="flex gap-2">
				<Button
					variant="destructive"
					onClick={() => handleDeleteProvider(organizationProvider)}
				>
					Delete Provider
				</Button>
			</div>
		</div>
	);
};

export { ManageOrganizationProvider };
