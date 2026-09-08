import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { useAuthenticatedRouteContext } from "./use-authenticated-route-context";

export const useIsInstanceAdmin = () => {
	const { auth } = useAuthenticatedRouteContext();

	return isInstanceAdminRole(auth.user.role);
};
