import { INSTANCE_ADMIN_ROLE } from "@orcai/core";

export const isInstanceAdminRole = (role: string | null | undefined) =>
	role === INSTANCE_ADMIN_ROLE;
