import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Organization } from "@/db/schema/organization";
import { orpc } from "@/lib/orpc/orpc";
import { OrganizationForm } from "./organization-form";

const ManageOrganization = ({
	organization,
}: {
	organization: Organization;
}) => {
	const queryClient = useQueryClient();
	const { mutateAsync: deleteOrganization } = useMutation(
		orpc.organization.delete.mutationOptions({
			onSuccess() {
				queryClient.invalidateQueries({
					queryKey: orpc.organization.list.key(),
				});
			},
		}),
	);

	const handleDeleteOrganization = (organizationId: string) => {
		toast.promise(deleteOrganization({ refs: [{ id: organizationId }] }), {
			loading: "Deleting organisation...",
			success: "Organisation deleted",
			error: (error) => ({
				message: "Failed to delete organisation",
				description: error.message,
			}),
		});
	};

	return (
		<div className="mt-4 flex flex-col gap-4">
			<OrganizationForm organization={organization} />
			<div className="flex gap-2">
				<Button
					variant="destructive"
					onClick={() => handleDeleteOrganization(organization.id)}
				>
					Delete Organisation
				</Button>
			</div>
		</div>
	);
};

export { ManageOrganization };
