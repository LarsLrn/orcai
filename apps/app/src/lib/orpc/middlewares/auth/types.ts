import type { organizationIdSchema, userIdSchema } from "@orcai/schema";
import type { authClient } from "@/lib/auth/auth-client";

export interface AuthContext {
	auth: {
		isAuthenticated: true;
		session: Omit<
			typeof authClient.$Infer.Session.session,
			"activeOrganizationId"
		> & {
			activeOrganizationId:
				| ReturnType<typeof organizationIdSchema.parse>
				| undefined;
		};
		user: Omit<typeof authClient.$Infer.Session.user, "id"> & {
			id: ReturnType<typeof userIdSchema.parse>;
		};
	};
}
