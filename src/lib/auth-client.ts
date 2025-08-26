import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

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
	baseURL: process.env.VITE_BASE_URL,
});
