import { afterAll, describe, expect, test } from "bun:test";
import { v1 } from "@authzed/authzed-node";
import { SpiceDbService } from "@orcai/spice-db";
import { ORPCError } from "@orpc/server";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import { toolErrorText } from "@/lib/ai/tools/tool-error";
import { mapEffectErrors } from "@/lib/orpc/implementation/error-mapping";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, organizationWith, createAsset, procedureOptions } =
	appIntegration();

const procedures = await run(Procedures);

const unreachable = v1.NewClient(
	"unreachable",
	"127.0.0.1:1",
	v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
).promises;

afterAll(() => {
	unreachable.close();
});

type ObjectType = "organization" | "asset";

/** The real SpiceDB, except that reads about `objectType` go to a closed port. */
const failingReadsAbout = (
	real: v1.ZedPromiseClientInterface,
	objectType: ObjectType,
) =>
	new Proxy(real, {
		get(target, property) {
			switch (property) {
				case "checkPermission":
					return (request: v1.CheckPermissionRequest) =>
						(request.resource?.objectType === objectType
							? unreachable
							: target
						).checkPermission(request);
				case "checkBulkPermissions":
					return (request: v1.CheckBulkPermissionsRequest) =>
						(request.items.some(
							(item) => item.resource?.objectType === objectType,
						)
							? unreachable
							: target
						).checkBulkPermissions(request);
				case "lookupResources":
					return (request: v1.LookupResourcesRequest) =>
						(request.resourceObjectType === objectType
							? unreachable
							: target
						).lookupResources(request);
				default: {
					const value = Reflect.get(target, property);
					return typeof value === "function" ? value.bind(target) : value;
				}
			}
		},
	});

/** What a caller sees: the code and reason, or "ok". */
const answer = (operation: Effect.Effect<unknown, unknown>) =>
	run(operation).then(
		() => "ok",
		(error: unknown) =>
			error instanceof ORPCError
				? `${error.code} ${
						(
							error.data as
								| {
										reason?: string;
								  }
								| undefined
						)?.reason
					}`
				: String(error),
	);

const setup = async () => {
	const {
		organizationId,
		actors: [owner],
	} = await organizationWith([
		"admin",
	]);
	const { asset, zedToken } = await createAsset(owner, organizationId);

	/** Options as the HTTP handler builds them at `token`, over a SpiceDB failing reads about `objectType`. */
	const failingAbout = async (
		actor: Actor,
		objectType?: ObjectType,
		token = zedToken,
	) => {
		const options = await procedureOptions(actor, token);
		const context = options.context["effect/context"];
		const { spice } = Context.get(context, SpiceDbService);
		return {
			context: {
				...options.context,
				"effect/wrap": mapEffectErrors,
				"effect/context": objectType
					? Context.add(context, SpiceDbService, {
							spice: failingReadsAbout(spice, objectType),
						})
					: context,
			},
		};
	};

	return {
		organizationId,
		owner,
		asset,
		failingAbout,
	};
};

describe("SpiceDB unavailable", () => {
	test(
		"a gate, a list, a find and the route guards' check answer 503",
		async () => {
			const { owner, asset, failingAbout } = await setup();
			const onOrganizations = await failingAbout(owner, "organization");
			const onAssets = await failingAbout(owner, "asset");
			const unavailable = "SERVICE_UNAVAILABLE PERMISSIONS_UNAVAILABLE";

			expect(
				await answer(procedures.organizationMember.list({}, onOrganizations)),
			).toBe(unavailable);
			expect(
				await answer(
					procedures.asset.list(
						{
							pageIndex: 0,
							pageSize: 10,
						},
						onAssets,
					),
				),
			).toBe(unavailable);
			expect(
				await answer(
					procedures.asset.find(
						{
							id: asset.id,
						},
						onAssets,
					),
				),
			).toBe(unavailable);
			expect(
				await answer(
					procedures.authorization.check(
						{
							entityType: "asset",
							entityId: asset.id,
							permission: "edit",
						},
						onAssets,
					),
				),
			).toBe(unavailable);
		},
		TIMEOUT,
	);

	test(
		"the organisation list still answers from Postgres",
		async () => {
			const { organizationId, owner, failingAbout } = await setup();

			const { data } = await run(
				procedures.organization.list(
					{
						pageIndex: 0,
						pageSize: 10,
					},
					await failingAbout(owner, "organization"),
				),
			);

			expect(data.map(({ id }) => id)).toEqual([
				organizationId,
			]);
		},
		TIMEOUT,
	);

	test(
		"the Assistant reads the reason and a retry hint",
		async () => {
			const { owner, asset, failingAbout } = await setup();

			const error = await run(
				procedures.asset.find(
					{
						id: asset.id,
					},
					await failingAbout(owner, "asset"),
				),
			).catch((failure: unknown) => failure);

			expect(toolErrorText(error)).toBe(
				"PERMISSIONS_UNAVAILABLE: Permissions could not be checked right now. Try again shortly.",
			);
		},
		TIMEOUT,
	);

	test(
		"a token SpiceDB rejects stays a server error",
		async () => {
			const { owner, asset, failingAbout } = await setup();

			expect(
				await answer(
					procedures.asset.find(
						{
							id: asset.id,
						},
						await failingAbout(owner, undefined, "not-a-zed-token"),
					),
				),
			).toBe("INTERNAL_SERVER_ERROR undefined");
		},
		TIMEOUT,
	);
});
