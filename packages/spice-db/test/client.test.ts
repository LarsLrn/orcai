import { describe, expect, mock, test } from "bun:test";
import { v1 } from "@authzed/authzed-node";
import type { AssetId, UserId } from "@orcai/core";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import {
	checkEntityPermission,
	grantedPermissions,
	permittedEntityIds,
	SpiceDbError,
	SpiceDbService,
} from "../src";

const userId = "00000000-0000-4000-8000-000000000001" as UserId;
const assetA = "00000000-0000-4000-8000-00000000000a" as AssetId;
const assetB = "00000000-0000-4000-8000-00000000000b" as AssetId;

const { HAS_PERMISSION, NO_PERMISSION, CONDITIONAL_PERMISSION } =
	v1.CheckPermissionResponse_Permissionship;

/** A SpiceDB that grants exactly the `id#permission` keys in `grants` and fails those in `failing`. */
const fakeSpice = (params: {
	grants?: readonly string[];
	failing?: readonly string[];
}) => {
	const permissionship = (resourceId = "", permission = "") =>
		params.grants?.includes(`${resourceId}#${permission}`)
			? HAS_PERMISSION
			: NO_PERMISSION;

	return {
		checkPermission: mock(async (request: v1.CheckPermissionRequest) =>
			v1.CheckPermissionResponse.create({
				permissionship: permissionship(
					request.resource?.objectId,
					request.permission,
				),
			}),
		),
		checkBulkPermissions: mock(
			async (request: v1.CheckBulkPermissionsRequest) =>
				v1.CheckBulkPermissionsResponse.create({
					pairs: request.items.map((item) => {
						const key = `${item.resource?.objectId}#${item.permission}`;
						return params.failing?.includes(key)
							? {
									request: item,
									response: {
										oneofKind: "error" as const,
										error: {
											code: 9,
											message: "max depth exceeded",
											details: [],
										},
									},
								}
							: {
									request: item,
									response: {
										oneofKind: "item" as const,
										item: {
											permissionship: permissionship(
												item.resource?.objectId,
												item.permission,
											),
										},
									},
								};
					}),
				}),
		),
	};
};

const run = <A, E>(
	effect: Effect.Effect<A, E, SpiceDbService>,
	spice: ReturnType<typeof fakeSpice>,
) =>
	Effect.runPromiseExit(
		Effect.provideService(effect, SpiceDbService, {
			spice: spice as unknown as v1.ZedPromiseClientInterface,
		}),
	);

describe("checkEntityPermission", () => {
	test("allows only a definite grant", async () => {
		const spice = fakeSpice({
			grants: [
				`${assetA}#edit`,
			],
		});
		const check = (entityId: AssetId) =>
			run(
				checkEntityPermission({
					entityType: "asset",
					entityId,
					permission: "edit",
					userId,
				}),
				spice,
			);

		expect(await check(assetA)).toEqual(Exit.succeed(true));
		expect(await check(assetB)).toEqual(Exit.succeed(false));
	});

	test("reads a conditional grant as a denial", async () => {
		const spice = fakeSpice({});
		spice.checkPermission.mockResolvedValueOnce(
			v1.CheckPermissionResponse.create({
				permissionship: CONDITIONAL_PERMISSION,
			}),
		);

		const exit = await run(
			checkEntityPermission({
				entityType: "asset",
				entityId: assetA,
				permission: "edit",
				userId,
			}),
			spice,
		);

		expect(exit).toEqual(Exit.succeed(false));
	});
});

describe("grantedPermissions", () => {
	test("answers every entity and permission in one request", async () => {
		const spice = fakeSpice({
			grants: [
				`${assetA}#read`,
				`${assetA}#edit`,
				`${assetB}#read`,
			],
		});

		const exit = await run(
			grantedPermissions({
				entityType: "asset",
				entityIds: [
					assetA,
					assetB,
					assetA,
				],
				permissions: [
					"read",
					"edit",
				],
				userId,
			}),
			spice,
		);

		expect(spice.checkBulkPermissions).toHaveBeenCalledTimes(1);
		expect(spice.checkBulkPermissions.mock.calls[0]?.[0].items).toHaveLength(4);
		expect(Exit.isSuccess(exit) && exit.value).toEqual(
			new Map([
				[
					assetA,
					new Set([
						"read",
						"edit",
					]),
				],
				[
					assetB,
					new Set([
						"read",
					]),
				],
			]),
		);
	});

	test("splits checks beyond SpiceDB's per-request cap", async () => {
		const spice = fakeSpice({});
		const entityIds = Array.from(
			{
				length: 5001,
			},
			(_, index) =>
				`00000000-0000-4000-8000-${String(index).padStart(12, "0")}` as AssetId,
		);

		await run(
			grantedPermissions({
				entityType: "asset",
				entityIds,
				permissions: [
					"read",
					"edit",
				],
				userId,
			}),
			spice,
		);

		expect(
			spice.checkBulkPermissions.mock.calls.map(
				([request]) => request.items.length,
			),
		).toEqual([
			10_000,
			2,
		]);
	});

	test("fails when SpiceDB cannot evaluate an item", async () => {
		const spice = fakeSpice({
			grants: [
				`${assetA}#read`,
			],
			failing: [
				`${assetB}#read`,
			],
		});

		const exit = await run(
			Effect.flip(
				permittedEntityIds({
					entityType: "asset",
					entityIds: [
						assetA,
						assetB,
					],
					permission: "read",
					userId,
				}),
			),
			spice,
		);

		expect(Exit.isSuccess(exit) && exit.value).toBeInstanceOf(SpiceDbError);
	});

	test("asks SpiceDB nothing for no entities", async () => {
		const spice = fakeSpice({});

		const exit = await run(
			permittedEntityIds({
				entityType: "asset",
				entityIds: [],
				permission: "read",
				userId,
			}),
			spice,
		);

		expect(spice.checkBulkPermissions).not.toHaveBeenCalled();
		expect(Exit.isSuccess(exit) && exit.value.size).toBe(0);
	});
});
