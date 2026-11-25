import type { organizationIdSchema, userIdSchema } from "@orcai/schema";
import type { Auth } from "@/lib/auth/auth";

export interface AuthContext {
	reqHeaders: Headers;
	auth: {
		isAuthenticated: true;
		session: Omit<
			Auth["$Infer"]["Session"]["session"],
			"activeOrganizationId"
		> & {
			activeOrganizationId:
				| ReturnType<typeof organizationIdSchema.parse>
				| undefined;
		};
		user: Omit<Auth["$Infer"]["Session"]["user"], "id"> & {
			id: ReturnType<typeof userIdSchema.parse>;
		};
	};
}
