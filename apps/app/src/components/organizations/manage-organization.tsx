import { Button } from "@/components/ui/button";
import { useDeleteOrganizationsMutation } from "@/hooks/mutations/use-organization-mutations";
import type { Organization } from "@/lib/orpc/schemas/organization";
import { OrganizationForm } from "./form/organization-form";

const ManageOrganization = ({
	organization,
}: {
	organization: Organization;
}) => {
	const { mutate: deleteOrganizations } = useDeleteOrganizationsMutation();

	return (
		<div className="mt-4 flex flex-col gap-4">
			<OrganizationForm action="update" organization={organization} />
			<div className="flex gap-2">
				<Button
					variant="destructive"
					onClick={() =>
						deleteOrganizations({
							refs: [
								{
									id: organization.id,
								},
							],
						})
					}
				>
					Delete Organisation
				</Button>
			</div>
		</div>
	);
};

export { ManageOrganization };
