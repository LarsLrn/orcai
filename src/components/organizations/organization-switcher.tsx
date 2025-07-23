import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
	DropdownMenuGroup,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { Organization } from "@/db/schema/organization";
import { authClient } from "@/lib/auth-client";
import { organizationQueryOptions } from "@/lib/query-options/organization";
import { userQueryOptions } from "@/lib/query-options/user";

const OrganizationSwitcher = () => {
	const { auth } = useRouteContext({ from: "/app" });
	const { refetch: refetchSession } = authClient.useSession();

	const { data: organizations, status } = useQuery(
		organizationQueryOptions.list({ input: { pageIndex: 0, pageSize: 100 } }),
	);

	const { mutateAsync: setActiveOrganization } = useMutation(
		userQueryOptions.setActiveOrganization(),
	);

	const navigate = useNavigate();
	const { setOpenMobile } = useSidebar();

	const handleOrganizationChange = (organization: Organization) => {
		toast.promise(setActiveOrganization({ organizationId: organization.id }), {
			loading: `Changing organization to ${organization.name}...`,
			success: async () => {
				refetchSession();
				setOpenMobile(false);
				await navigate({ to: "/app" });

				return "Organization changed successfully!";
			},
			error: (error) => ({
				message: "Failed to change organization",
				description: error.message,
			}),
		});
	};

	if (status === "pending") return <Skeleton className="h-12 w-full" />;
	if (status === "error") {
		return <div>Error loading organizations</div>;
	}

	return (
		<DropdownMenuGroup>
			{organizations.data.map((organization) => (
				<DropdownMenuItem
					key={organization.id}
					onSelect={() => handleOrganizationChange(organization)}
				>
					{organization.name}
					{auth.session.activeOrganizationId === organization.id && (
						<Check className="ml-auto" />
					)}
				</DropdownMenuItem>
			))}
		</DropdownMenuGroup>
	);
};

export { OrganizationSwitcher };
