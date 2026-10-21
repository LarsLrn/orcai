import { describe, expect, test } from "bun:test";
import { v1 } from "@authzed/authzed-node";
import type { BotId, UserId } from "@orcai/core";
import { SpiceDbService } from "@orcai/spice-db";
import * as Effect from "effect/Effect";
import { requirePermission } from "./core";

const userId = "00000000-0000-4000-8000-000000000001" as UserId;
const botId = "00000000-0000-4000-8000-000000000002" as BotId;

const withSpiceAnswering = (
	permissionship: v1.CheckPermissionResponse_Permissionship,
) =>
	Effect.provideService(SpiceDbService, {
		spice: {
			checkPermission: async () =>
				v1.CheckPermissionResponse.create({
					permissionship,
				}),
		} as unknown as v1.ZedPromiseClientInterface,
	});

const requireBotEdit = requirePermission({
	entityType: "bot",
	entityId: botId,
	permission: "edit",
	userId,
	zedToken: "token",
});

describe("requirePermission", () => {
	test("passes a granted permission", async () => {
		await Effect.runPromise(
			requireBotEdit.pipe(
				withSpiceAnswering(
					v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION,
				),
			),
		);
	});

	test("denies with a sentence and the checked permission", async () => {
		const error = await Effect.runPromise(
			Effect.flip(requireBotEdit).pipe(
				withSpiceAnswering(
					v1.CheckPermissionResponse_Permissionship.NO_PERMISSION,
				),
			),
		);

		expect(error).toMatchObject({
			_tag: "ForbiddenError",
			reason: "PERMISSION_DENIED",
			message: 'You do not have the "edit" permission on this bot.',
			data: {
				entityType: "bot",
				permission: "edit",
				zedToken: "token",
			},
		});
	});
});
