import { describe, expect, test } from "bun:test";
import { v1 } from "@authzed/authzed-node";
import type { BotId, UserId } from "@orcai/core";
import { SpiceDbService } from "@orcai/spice-db";
import { spiceClient } from "@orcai/spice-db/testing";
import { call, os, type } from "@orpc/server";
import * as Context from "effect/Context";
import { mapEffectErrors } from "@/lib/orpc/implementation/error-mapping";
import type { AppEffectContext } from "@/lib/orpc/implementation/os";
import type { AuthContext } from "@/lib/orpc/middlewares/auth";
import { requireEntityPermission } from "./require";

const userId = "00000000-0000-4000-8000-000000000001" as UserId;
const botId = "00000000-0000-4000-8000-000000000002" as BotId;

/**
 * What SpiceDB answers: at a token, as of that revision, which may be all a
 * replica has; fully consistent, as of the newest; without consistency, as
 * of a stale cache that misses every write here.
 */
type Revisions = {
	allowedAt: Record<string, boolean>;
	newest: boolean;
};

/** The checks the procedures below make; any other check is denied. */
const expectedChecks = new Set([
	`bot:${botId}#edit@user:${userId}`,
]);

const answer = (revisions: Revisions, request: v1.CheckPermissionRequest) => {
	const check = `${request.resource?.objectType}:${request.resource?.objectId}#${request.permission}@${request.subject?.object?.objectType}:${request.subject?.object?.objectId}`;
	if (!expectedChecks.has(check)) return false;
	const requirement = request.consistency?.requirement;
	switch (requirement?.oneofKind) {
		case "fullyConsistent":
			return revisions.newest;
		case "atLeastAsFresh":
			return revisions.allowedAt[requirement.atLeastAsFresh.token] ?? false;
		default:
			return false;
	}
};

const requestContext = (requestToken: string, revisions: Revisions) => ({
	reqHeaders: new Headers(),
	auth: {
		isAuthenticated: true as const,
		session: {},
		user: {
			id: userId,
		},
	} as unknown as AuthContext["auth"],
	meta: {
		zedToken: requestToken,
	},
	"effect/context": Context.make(SpiceDbService, {
		spice: spiceClient({
			checkPermission: async (request) =>
				v1.CheckPermissionResponse.create({
					permissionship: answer(revisions, request)
						? v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
						: v1.CheckPermissionResponse_Permissionship.NO_PERMISSION,
				}),
		}),
	}) as AppEffectContext["effect/context"],
	"effect/wrap": mapEffectErrors,
});

const base = os.$context<AppEffectContext & AuthContext>();

const procedure = base
	.input(
		type<{
			id: BotId;
			zedToken?: string;
		}>(),
	)
	.use(
		requireEntityPermission("bot", "edit", {
			entityId: "id",
		}),
	)
	.handler(() => "allowed");

const outcome = (promise: Promise<unknown>) =>
	promise.then(
		(value) => value,
		(error: { code?: string }) => error.code,
	);

/** The middleware's answer for one input token. */
const outcomeFor = (
	zedToken: string,
	context: ReturnType<typeof requestContext>,
) =>
	outcome(
		call(
			procedure,
			{
				id: botId,
				zedToken,
			},
			{
				context,
			},
		),
	);

describe("requireEntityPermission", () => {
	test("see a grant the input's token names, though the request carries an older token", async () => {
		const context = requestContext("before-grant", {
			allowedAt: {
				"after-grant": true,
			},
			newest: true,
		});

		expect(await outcomeFor("after-grant", context)).toBe("allowed");
	});

	test("see a revocation the request's token covers, though the input carries an older token", async () => {
		const context = requestContext("after-revocation", {
			allowedAt: {
				"before-revocation": true,
			},
			newest: false,
		});

		expect(await outcomeFor("before-revocation", context)).toBe("FORBIDDEN");
	});

	test("read an empty input token as none, at the request's token", async () => {
		const context = requestContext("after-grant", {
			allowedAt: {
				"after-grant": true,
			},
			newest: true,
		});

		expect(await outcomeFor("", context)).toBe("allowed");
	});
});
