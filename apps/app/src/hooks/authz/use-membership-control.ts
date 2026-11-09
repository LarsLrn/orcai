import { useRouteContext } from "@tanstack/react-router";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { membershipControl } from "@/lib/labels/organization-role";

/** Which memberships and invitations of the active organisation the user may manage. */
export const useMembershipControl = () => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data } = useOrganizationCapabilities();

	return membershipControl({
		userId: auth.user.id,
		capabilities: data?.data.capabilities,
	});
};
