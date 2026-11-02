import { definePlugin } from "nitro";
import {
	CONTENT_SECURITY_POLICY,
	contentSecurityPolicy,
} from "./content-security-policy";

const policy = contentSecurityPolicy();

/**
 * Nitro answers static files, revalidations and its own errors without the
 * app, so those responses get the policy here.
 */
export default definePlugin((nitroApp) => {
	nitroApp.hooks?.hook("response", (response) => {
		if (!response.headers.has(CONTENT_SECURITY_POLICY)) {
			response.headers.set(CONTENT_SECURITY_POLICY, policy);
		}
	});
});
