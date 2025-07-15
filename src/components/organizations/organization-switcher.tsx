import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

const OrganizationSwitcher = () => {
	const queryClient = useQueryClient();
	const { data: organizations, isPending } = authClient.useListOrganizations();
	const { data: activeOrganization } = authClient.useActiveOrganization();

	const navigate = useNavigate();
	const { setOpenMobile } = useSidebar();

	const handleOrganizationChange = async (
		organization: typeof authClient.$Infer.Organization,
	) => {
		// TODO: Refactor to use toast.promise
		await authClient.organization
			.setActive({
				organizationId: organization.id,
			})
			.then(() => {
				navigate({ to: "/app" });
				queryClient.clear();
				toast.success(`Organization changed to ${organization?.name}`);
				setOpenMobile(false);
			})
			.catch((error) => {
				toast.error(`Failed to change organization: ${error.message}`);
			});
	};

	if (isPending || !organizations) return <Skeleton className="h-12 w-full" />;

	return (
		<DropdownMenuGroup>
			{organizations.map((organization) => (
				<DropdownMenuItem
					key={organization.id}
					onSelect={() => handleOrganizationChange(organization)}
				>
					{organization.name}
					{activeOrganization?.id === organization.id && (
						<Check className="ml-auto" />
					)}
				</DropdownMenuItem>
			))}
		</DropdownMenuGroup>
	);
};

export { OrganizationSwitcher };
