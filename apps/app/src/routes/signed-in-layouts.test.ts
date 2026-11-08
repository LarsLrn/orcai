import { describe, expect, mock, test } from "bun:test";
import { isRedirect } from "@tanstack/react-router";
import { scriptedOrpc } from "@/lib/testing/scripted-orpc";

mock.module("@/lib/auth/auth", () => ({
	auth: {},
}));
mock.module("@/lib/effect/runtime", () => ({
	runPromise: () => Promise.reject(new Error("not in unit tests")),
}));
mock.module("@/lib/auth/auth-client", () => ({
	authClient: {},
}));
mock.module("@/lib/orpc/orpc", () => scriptedOrpc());

const layouts = {
	"/app": (await import("./app/route")).Route,
	"/instance": (await import("./instance/route")).Route,
	"/history": (await import("./_pathlessLayout/history/route")).Route,
	"/select-organization": (
		await import("./_pathlessLayout/select-organization")
	).Route,
};

type BeforeLoad = (context: {
	context: {
		auth: unknown;
	};
}) => unknown;

/** Where the layout's `beforeLoad` sends a visitor with `auth`. */
const redirectOf = async (
	route: {
		options: unknown;
	},
	auth: unknown,
) => {
	const { beforeLoad } = route.options as {
		beforeLoad: BeforeLoad;
	};
	try {
		await beforeLoad({
			context: {
				auth,
			},
		});
	} catch (error) {
		if (isRedirect(error)) return error.options.to;
		throw error;
	}
	return undefined;
};

describe("signed-in layouts", () => {
	test.each(Object.entries(layouts))(
		"%s sends a signed-out visitor to sign in",
		async (_, route) => {
			expect(
				await redirectOf(route, {
					isAuthenticated: false,
				}),
			).toBe("/login");
		},
	);

	test.each(Object.entries(layouts))(
		"%s sends a user the policy covers to set up two-factor authentication first",
		async (_, route) => {
			expect(
				await redirectOf(route, {
					isAuthenticated: true,
					session: {
						activeOrganizationId: null,
					},
					user: {
						role: "user",
					},
					twoFactor: {
						setupRequired: true,
						enforced: true,
					},
				}),
			).toBe("/setup-two-factor");
		},
	);
});
