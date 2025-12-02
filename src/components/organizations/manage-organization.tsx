import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc/orpc";
import type { Organization } from "@/lib/orpc/schemas/organization";
import { OrganizationForm } from "./organization-form";

const ManageOrganization = ({
	organization,
}: {
	organization: Organization;
}) => {
	const { mutateAsync: deleteOrganization } = useMutation(
		orpc.organization.delete.mutationOptions(),
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
