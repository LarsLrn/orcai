import { describe, expect, mock, test } from "bun:test";
import { ORPCError } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";
import { scriptedOrpc } from "@/lib/testing/scripted-orpc";

/** How the server answers every permission check; set by each test. */
let answer: () => Promise<{
	allowed: boolean;
	capabilities: Record<string, boolean>;
}> = () => Promise.reject(new Error("No answer scripted"));

mock.module("@/lib/orpc/orpc", () =>
	scriptedOrpc({
		authorization: {
			check: async () => {
				const { allowed } = await answer();
				return {
					data: {
						allowed,
					},
				};
			},
			organizationCapabilities: async () => {
				const { capabilities } = await answer();
				return {
					data: {
						capabilities,
					},
				};
			},
		},
	}),
);

const { ensureEntityCapability, ensureOrganizationCapability } = await import(
	"@/lib/authz/route-guards"
);
const { orNotFound } = await import("@/lib/router/not-found");

const unavailable = new ORPCError("SERVICE_UNAVAILABLE", {
	data: {
		reason: "PERMISSIONS_UNAVAILABLE",
	},
});

/** The guards of a page on a server that settles every check with `outcome`. */
const answering = (outcome: typeof answer) => {
	answer = outcome;
	return new QueryClient();
};

const guards = (queryClient: QueryClient) => [
	ensureOrganizationCapability({
		queryClient,
		permission: "manage_members",
	}),
	ensureEntityCapability({
		queryClient,
		entityType: "bot",
		entityId: "00000000-0000-4000-8000-000000000001",
		permission: "edit",
	}),
];

const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => undefined,
		(error: unknown) => error,
	);

describe("route guards", () => {
	test("render not found only after a check that answered no", async () => {
		const denied = answering(() =>
			Promise.resolve({
				allowed: false,
				capabilities: {},
			}),
		);

		for (const guard of guards(denied))
			expect(isNotFound(await rejection(guard))).toBe(true);
	});

	test("pass a check that failed on to the error page", async () => {
		const failing = answering(() => Promise.reject(unavailable));

		for (const guard of guards(failing))
			expect(await rejection(guard)).toBe(unavailable);
		expect(await rejection(orNotFound(Promise.reject(unavailable)))).toBe(
			unavailable,
		);
	});
});
