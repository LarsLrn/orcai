import { beforeEach, describe, expect, mock, test } from "bun:test";
import { INSTANCE_ADMIN_ROLE } from "@orcai/core";
import { userIdSchema } from "@orcai/schema";
import { call, ORPCError, os } from "@orpc/server";
import * as Context from "effect/Context";
import type { AppEffectContext } from "@/lib/orpc/implementation/os";

const USER_ID = userIdSchema.parse("7b6d7c0e-2a3f-4c1d-9e8f-0a1b2c3d4e5f");

/** What Better Auth answers for the request cookie; `null` is a signed-out visitor. */
let session: {
	session: Record<string, unknown>;
	user: Record<string, unknown>;
} | null = null;

const getSession = mock(() => Promise.resolve(session));

mock.module("@/lib/auth/auth", () => ({
	auth: {
		api: {
			getSession,
		},
	},
}));

const { AppConfigService } = await import("@/lib/effect/services/config");
const { mapEffectErrors } = await import(
	"@/lib/orpc/implementation/error-mapping"
);
const { requiredAuthMiddleware, requireInstanceAdminMiddleware } = await import(
	"./require"
);

const base = os.$context<
	AppEffectContext & {
		reqHeaders?: Headers;
	}
>();

/** A procedure guarded by a permission middleware, as a nested `call` reaches it. */
const inner = base
	.use(requiredAuthMiddleware)
	.use(requireInstanceAdminMiddleware)
	.handler(({ context }) => context.auth.user.id);

/** The outermost procedure of a request, calling `inner` with its own context. */
const outer = base.use(requiredAuthMiddleware).handler(({ context }) =>
	call(inner, undefined, {
		context,
	}),
);

const requestContext = () => ({
	reqHeaders: new Headers({
		cookie: "better-auth.session_token=token",
	}),
	"effect/context": Context.make(AppConfigService, {
		config: {
			auth: {
				twoFactorPolicy: "none",
			},
		} as never,
		docs: undefined,
		publicConfig: {},
		warnings: [],
	}) as AppEffectContext["effect/context"],
	"effect/wrap": mapEffectErrors,
});

const signedInAs = (role: string) => {
	session = {
		session: {
			id: "session-1",
			userId: USER_ID,
			activeOrganizationId: null,
		},
		user: {
			id: USER_ID,
			role,
		},
	};
};

const rejection = async (promise: Promise<unknown>) => {
	const error = await promise.then(
		() => undefined,
		(cause: unknown) => cause,
	);
	if (!(error instanceof ORPCError)) {
		throw new Error("Expected an oRPC error");
	}
	return error;
};

describe("requiredAuthMiddleware", () => {
	beforeEach(() => {
		getSession.mockClear();
	});

	test("a request resolves its session once, and a nested call keeps it", async () => {
		signedInAs(INSTANCE_ADMIN_ROLE);

		expect(
			await call(outer, undefined, {
				context: requestContext(),
			}),
		).toBe(USER_ID);
		expect(getSession).toHaveBeenCalledTimes(1);
	});

	test("a nested call still runs its permission middleware", async () => {
		signedInAs("user");

		const error = await rejection(
			call(outer, undefined, {
				context: requestContext(),
			}),
		);

		expect(error.code).toBe("FORBIDDEN");
		expect(getSession).toHaveBeenCalledTimes(1);
	});

	test("a signed-out request is refused", async () => {
		session = null;

		const error = await rejection(
			call(outer, undefined, {
				context: requestContext(),
			}),
		);

		expect(error.code).toBe("UNAUTHORIZED");
		expect(getSession).toHaveBeenCalledTimes(1);
	});

	test("a failing session lookup answers as an internal error with its cause", async () => {
		const failure = new Error("database unavailable");
		getSession.mockImplementationOnce(() => Promise.reject(failure));

		const error = await rejection(
			call(outer, undefined, {
				context: requestContext(),
			}),
		);

		expect(error.code).toBe("INTERNAL_SERVER_ERROR");
		expect((error.cause as Error).cause).toBe(failure);
	});

	test("a context that only claims to be authenticated is not trusted", async () => {
		signedInAs(INSTANCE_ADMIN_ROLE);

		expect(
			await call(inner, undefined, {
				context: {
					...requestContext(),
					auth: {
						isAuthenticated: true,
					},
				},
			}),
		).toBe(USER_ID);
		expect(getSession).toHaveBeenCalledTimes(1);
	});
});
