import type { UserId } from "@orcai/core";
import * as Context from "effect/Context";
import { mapEffectErrors } from "@/lib/orpc/implementation/error-mapping";
import type {
	AppEffectContext,
	ORPCContext,
} from "@/lib/orpc/implementation/os";
import type { AuthContext } from "@/lib/orpc/middlewares/auth";

/**
 * A complete request context for unit tests, with fields replaced by
 * `overrides`. It provides no services, so code that reads one fails loudly.
 */
export const testRequestContext = (
	overrides: Partial<ORPCContext> = {},
): ORPCContext & {
	reqHeaders: Headers;
} => ({
	resHeaders: new Headers(),
	meta: {},
	secureCookies: false,
	"effect/context": Context.empty() as AppEffectContext["effect/context"],
	"effect/wrap": mapEffectErrors,
	...overrides,
	reqHeaders: overrides.reqHeaders ?? new Headers(),
});

/** A complete signed-in session and user for unit tests. */
export const testAuth = (userId: UserId): AuthContext["auth"] => {
	const now = new Date();
	return {
		isAuthenticated: true,
		session: {
			id: "test-session",
			token: "test-session-token",
			userId,
			activeOrganizationId: undefined,
			expiresAt: new Date(now.getTime() + 3_600_000),
			createdAt: now,
			updatedAt: now,
			ipAddress: null,
			userAgent: null,
			impersonatedBy: null,
		},
		user: {
			id: userId,
			name: "Ada",
			email: "ada@example.org",
			emailVerified: true,
			image: null,
			role: null,
			banned: null,
			banReason: null,
			banExpires: null,
			locale: null,
			twoFactorEnabled: false,
			createdAt: now,
			updatedAt: now,
		},
	};
};
