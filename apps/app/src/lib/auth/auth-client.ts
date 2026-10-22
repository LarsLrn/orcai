import { passkeyClient } from "@better-auth/passkey/client";
import { LOCALES } from "@orcai/schema";
import {
	inferAdditionalFields,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	plugins: [
		twoFactorClient(),
		passkeyClient(),
		inferAdditionalFields({
			user: {
				locale: {
					type: [
						...LOCALES,
					],
					required: false,
					input: true,
				},
			},
			session: {
				activeOrganizationId: {
					type: "string",
					required: false,
					input: true,
				},
			},
		}),
	],
});
