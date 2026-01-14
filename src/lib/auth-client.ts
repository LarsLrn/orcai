import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { clientEnv } from "@/lib/env/client";

export const authClient = createAuthClient({
	plugins: [
		adminClient(),
		inferAdditionalFields({
			session: {
				activeOrganizationId: {
					type: "string",
					required: false,
					input: true,
				},
			},
		}),
	],
	baseURL: clientEnv.VITE_BASE_URL,
});
