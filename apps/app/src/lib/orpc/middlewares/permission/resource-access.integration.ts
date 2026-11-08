import { describe, expect, test } from "bun:test";
import { v1 } from "@authzed/authzed-node";
import type { AssetId } from "@orcai/core";
import { type SpiceDbClient, SpiceDbService } from "@orcai/spice-db";
import * as Context from "effect/Context";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, organizationWith, createAsset, procedureOptions } =
	appIntegration();

/**
 * What SpiceDB answers about the asset under test: at a token, as of that
 * revision; fully consistent, as of the newest; without consistency, never.
 */
type Revisions = {
	allowedAt: Record<string, boolean>;
	newest: boolean;
};

const allowedBy = (
	revisions: Revisions,
	consistency: v1.Consistency | undefined,
) => {
	const requirement = consistency?.requirement;
	switch (requirement?.oneofKind) {
		case "fullyConsistent":
			return revisions.newest;
		case "atLeastAsFresh":
			return revisions.allowedAt[requirement.atLeastAsFresh.token] ?? false;
		default:
			return false;
	}
};

/** The real SpiceDB, except for bulk checks of `assetId`, which `revisions` answers. */
const spiceAnswering = (
	real: SpiceDbClient,
	assetId: AssetId,
	revisions: Revisions,
) =>
	new Proxy(real, {
		get(target, property) {
			if (property === "checkBulkPermissions") {
				return (request: v1.CheckBulkPermissionsRequest) => {
					if (
						!request.items.every((item) => item.resource?.objectId === assetId)
					) {
						return target.checkBulkPermissions(request);
					}
					const permissionship = allowedBy(revisions, request.consistency)
						? v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
						: v1.CheckPermissionResponse_Permissionship.NO_PERMISSION;
					return Promise.resolve(
						v1.CheckBulkPermissionsResponse.create({
							pairs: request.items.map((item) => ({
								request: item,
								response: {
									oneofKind: "item",
									item: {
										permissionship,
									},
								},
							})),
						}),
					);
				};
			}
			const value = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});

/**
 * An owner's asset, a member who reaches it by no committed path, and two
 * real tokens: one from before the asset was created and one from after.
 */
const setup = async () => {
	const {
		organizationId,
		actors: [owner, member],
		zedToken: before,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const {
		asset: { id: assetId },
		zedToken: after,
	} = await createAsset(owner, organizationId);
	const procedures = await run(Procedures);

	const find = async (
		actor: Actor,
		revisions: Revisions,
		tokens: {
			request: string;
			input?: string;
			turn?: string;
		},
	) => {
		const options = await procedureOptions(actor, tokens.request);
		const context = options.context["effect/context"];
		const { spice } = Context.get(context, SpiceDbService);
		return run(
			procedures.asset.find(
				{
					id: assetId,
					zedToken: tokens.input,
				},
				{
					context: {
						...options.context,
						"effect/context": Context.add(context, SpiceDbService, {
							spice: spiceAnswering(spice, assetId, revisions),
						}),
						meta: {
							zedToken: tokens.request,
							turnZedToken: tokens.turn,
						},
					},
				},
			),
		).then(
			() => "found",
			(error: { _tag?: string }) => error._tag,
		);
	};

	return {
		owner,
		member,
		before: before as string,
		after: after as string,
		find,
	};
};

describe("requireEntityAccess", () => {
	test(
		"refuses when SpiceDB and committed state disagree, either way",
		async () => {
			const { owner, member, after, find } = await setup();
			const always = {
				allowedAt: {
					[after]: true,
				},
				newest: true,
			};
			const never = {
				allowedAt: {},
				newest: false,
			};
			const request = {
				request: after,
			};

			expect(await find(owner, always, request)).toBe("found");
			expect(await find(owner, never, request)).toBe("NotFoundError");
			expect(await find(member, always, request)).toBe("NotFoundError");
		},
		TIMEOUT,
	);

	test(
		"reads at the newest revision when the input's, request's or turn's tokens differ",
		async () => {
			const { owner, before, after, find } = await setup();
			// Granted as of the input's token only: a read at the request's misses it.
			const grantedAfter = {
				allowedAt: {
					[after]: true,
				},
				newest: true,
			};
			// Revoked by the newest revision: a read at the request's still grants.
			const revokedSince = {
				allowedAt: {
					[before]: true,
				},
				newest: false,
			};

			expect(
				await find(owner, grantedAfter, {
					request: before,
					input: after,
				}),
			).toBe("found");
			expect(
				await find(owner, revokedSince, {
					request: before,
					input: after,
				}),
			).toBe("NotFoundError");
			expect(
				await find(owner, revokedSince, {
					request: before,
				}),
			).toBe("found");
			expect(
				await find(owner, revokedSince, {
					request: before,
					turn: after,
				}),
			).toBe("NotFoundError");
		},
		TIMEOUT,
	);
});
