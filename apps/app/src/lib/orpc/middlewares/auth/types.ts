import type { organizationIdSchema, userIdSchema } from "@orcai/schema";
import type { auth } from "@/lib/auth/auth";

export interface AuthContext {
	reqHeaders: Headers;
	auth: {
		isAuthenticated: true;
		session: Omit<
			typeof auth.$Infer.Session.session,
			"activeOrganizationId"
		> & {
			activeOrganizationId:
				| ReturnType<typeof organizationIdSchema.parse>
				| undefined;
		};
		user: Omit<typeof auth.$Infer.Session.user, "id"> & {
			id: ReturnType<typeof userIdSchema.parse>;
		};
	};
}
