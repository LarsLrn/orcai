import {
	adminClient,
	inferAdditionalFields,
	organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [
		adminClient(),
		organizationClient(),
		inferAdditionalFields({
			session: {
				activeCourseId: {
					type: "string",
					required: false,
					input: true,
				},
			},
		}),
	],
	baseURL: process.env.NEXT_PUBLIC_BASE_URL,
});
