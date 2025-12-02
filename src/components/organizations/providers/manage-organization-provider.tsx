import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";
import type { OrganizationProvider } from "@/lib/orpc/schemas/organization-provider";
import { OrganizationProviderForm } from "./organization-provider-form";

const ManageOrganizationProvider = ({
	organizationId,
	organizationProvider,
}: {
	organizationId: string;
	organizationProvider: OrganizationProvider;
}) => {
	const { mutateAsync: deleteProvider } = useMutation(
		orpc.organizationProvider.delete.mutationOptions(),
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
