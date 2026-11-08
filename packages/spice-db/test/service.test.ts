import { afterAll, describe, expect, test } from "bun:test";
import { createServer, type Socket } from "node:net";
import { setTimeout } from "node:timers/promises";
import type { AssetId, UserId } from "@orcai/core";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import {
	checkEntityPermission,
	grpcStatusOf,
	isUnavailable,
	permittedEntityIds,
	SpiceDbConfigService,
	type SpiceDbError,
	SpiceDbServiceLive,
	writeRelationshipMutations,
} from "../src";

const userId = "00000000-0000-4000-8000-000000000001" as UserId;
const assetId = "00000000-0000-4000-8000-00000000000a" as AssetId;

// Accepts connections and never answers, like a SpiceDB that hangs.
const sockets = new Set<Socket>();
const silent = createServer((socket) => {
	sockets.add(socket);
});
await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
const silentPort = (
	silent.address() as {
		port: number;
	}
).port;

afterAll(() => {
	for (const socket of sockets) socket.destroy();
	silent.close();
});

const spiceAt = (port: number) =>
	SpiceDbServiceLive.pipe(
		Layer.provide(
			Layer.succeed(SpiceDbConfigService, {
				config: {
					endpoint: `127.0.0.1:${port}`,
					token: Redacted.make("token"),
					security: "insecure-plaintext",
					readTimeout: Duration.millis(100),
				},
			}),
		),
	);

const failure = <A>(
	effect: Effect.Effect<A, SpiceDbError, never>,
): Promise<SpiceDbError> => Effect.runPromise(Effect.flip(effect));

describe("SpiceDbServiceLive", () => {
	test("ends a read SpiceDB does not answer at the read timeout", async () => {
		const layer = spiceAt(silentPort);
		const started = Date.now();

		const errors = await Promise.all([
			failure(
				checkEntityPermission({
					entityType: "asset",
					entityId: assetId,
					permission: "read",
					userId,
				}).pipe(Effect.provide(layer)),
			),
			failure(
				permittedEntityIds({
					entityIds: [
						assetId,
					],
					entityType: "asset",
					permission: "read",
					userId,
				}).pipe(Effect.provide(layer)),
			),
		]);

		expect(Date.now() - started).toBeLessThan(2_000);
		expect(errors.map(grpcStatusOf)).toEqual([
			"DEADLINE_EXCEEDED",
			"DEADLINE_EXCEEDED",
		]);
		expect(errors.every(isUnavailable)).toBe(true);
	});

	test("leaves writes to the client's own deadline", async () => {
		const write = Effect.runPromise(
			writeRelationshipMutations([
				{
					resourceType: "asset",
					resourceId: assetId,
					relation: "owner",
					subjectType: "user",
					subjectId: userId,
				},
			]).pipe(Effect.provide(spiceAt(silentPort))),
		).then(
			() => "settled",
			() => "settled",
		);

		const outcome = await Promise.race([
			write,
			setTimeout(400).then(() => "pending"),
		]);

		expect(outcome).toBe("pending");
	});

	test("reads an unreachable SpiceDB as unavailable", async () => {
		const closed = createServer();
		await new Promise<void>((resolve) =>
			closed.listen(0, "127.0.0.1", resolve),
		);
		const port = (
			closed.address() as {
				port: number;
			}
		).port;
		await new Promise<void>((resolve) => closed.close(() => resolve()));

		const error = await failure(
			checkEntityPermission({
				entityType: "asset",
				entityId: assetId,
				permission: "read",
				userId,
			}).pipe(Effect.provide(spiceAt(port))),
		);

		expect(grpcStatusOf(error)).toBe("UNAVAILABLE");
		expect(isUnavailable(error)).toBe(true);
	});
});
