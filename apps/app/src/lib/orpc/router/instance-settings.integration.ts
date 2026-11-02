import { afterAll, describe, expect, test } from "bun:test";
import { DB } from "@orcai/db";
import {
	EmbeddingIndex,
	type EmbeddingIndexScope,
	embeddingSettings,
	storedEmbeddingApiKey,
} from "@orcai/qdrant";
import { testEmbeddingIndex } from "@orcai/testing";
import { serve } from "bun";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	onEmbeddingIndex,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const DIMENSIONS = 6;
const WIDE_DIMENSIONS = 8;
const API_KEY = "sk-integration-secret";

/** The next request to `/held`, with its key, waiting for the test to let it through. */
let held:
	| {
			readonly reached: (authorization: string | null) => void;
			readonly release: Promise<void>;
	  }
	| undefined;

/**
 * OpenAI-compatible endpoints, one per path: `/ok` embeds and lists its
 * models, `/held` too once the test lets it, `/wide` embeds with more
 * dimensions, the others fail the way their name says.
 */
const endpoints = serve({
	port: 0,
	fetch: async (request) => {
		const [, kind, , route] = new URL(request.url).pathname.split("/");
		if (kind === "held" && held) {
			const { reached, release } = held;
			held = undefined;
			reached(request.headers.get("authorization"));
			await release;
		}
		if (kind === "unauthorized") {
			return Response.json(
				{
					error: {
						message: "Incorrect API key provided",
					},
				},
				{
					status: 401,
				},
			);
		}
		if (kind === "missing-model") {
			return Response.json(
				{
					error: {
						message: "The model `nope` does not exist",
						code: "model_not_found",
					},
				},
				{
					status: 404,
				},
			);
		}
		if (kind === "garbage") {
			return Response.json({
				object: "list",
				data: [],
			});
		}
		if (route === "models") {
			return Response.json({
				object: "list",
				data: [
					{
						id: "integration-embedding",
						object: "model",
					},
				],
			});
		}
		return Response.json({
			object: "list",
			data: [
				{
					object: "embedding",
					index: 0,
					embedding: Array.from(
						{
							length: kind === "wide" ? WIDE_DIMENSIONS : DIMENSIONS,
						},
						() => 0.5,
					),
				},
			],
			model: "integration-embedding",
			usage: {
				prompt_tokens: 1,
				total_tokens: 1,
			},
		});
	},
});
afterAll(() => endpoints.stop(true));

const endpoint = (kind: string) => `${endpoints.url.origin}/${kind}/v1`;
// Nothing listens on the discard port.
const UNREACHABLE = "http://127.0.0.1:9/v1";

const { run, organizationWith, procedureOptions, instanceAdmin } =
	authzIntegration();

const indexes = {
	racing: await testEmbeddingIndex(),
	denial: await testEmbeddingIndex(),
	failures: await testEmbeddingIndex(),
	saves: await testEmbeddingIndex(),
	changes: await testEmbeddingIndex(),
	reembed: await testEmbeddingIndex(),
	confirming: await testEmbeddingIndex(),
	sameTarget: await testEmbeddingIndex(),
	discovery: await testEmbeddingIndex(),
};

const call = async (actor: Actor, index: EmbeddingIndexScope) => ({
	procedures: await run(Procedures),
	options: onEmbeddingIndex(await procedureOptions(actor), index),
});

const reasonOf = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: { reason?: string }) => error.reason,
	);

const actors = async () => {
	const {
		organizationId,
		actors: [member],
	} = await organizationWith([
		"admin",
	]);
	return {
		member,
		admin: await instanceAdmin(organizationId),
	};
};

describe("instance settings", () => {
	test(
		"only instance admins read, change, list models, count, retry and re-embed; anyone signed in sees whether search works",
		async () => {
			const { member } = await actors();
			const { procedures, options } = await call(member, indexes.denial);

			expect(
				await reasonOf(run(procedures.instanceSettings.find({}, options))),
			).toBe("INSTANCE_ADMIN_REQUIRED");
			expect(
				await reasonOf(
					run(
						procedures.instanceSettings.updateEmbeddings(
							{
								baseUrl: endpoint("ok"),
								apiKey: API_KEY,
								model: "integration-embedding",
							},
							options,
						),
					),
				),
			).toBe("INSTANCE_ADMIN_REQUIRED");
			expect(
				await reasonOf(
					run(
						procedures.instanceSettings.discoverEmbeddingModels(
							{
								baseUrl: endpoint("ok"),
								apiKey: API_KEY,
							},
							options,
						),
					),
				),
			).toBe("INSTANCE_ADMIN_REQUIRED");
			expect(
				await Promise.all([
					reasonOf(
						run(procedures.instanceSettings.embeddingProgress({}, options)),
					),
					reasonOf(
						run(procedures.instanceSettings.retryFailedEmbeddings({}, options)),
					),
					reasonOf(
						run(
							procedures.instanceSettings.reembedEmbeddings(
								{
									generation: 1,
								},
								options,
							),
						),
					),
				]),
			).toEqual([
				"INSTANCE_ADMIN_REQUIRED",
				"INSTANCE_ADMIN_REQUIRED",
				"INSTANCE_ADMIN_REQUIRED",
			]);
			expect(
				(await run(procedures.instanceSettings.embeddingsStatus({}, options)))
					.data,
			).toEqual({
				configured: false,
				rebuilding: false,
			});
		},
		TIMEOUT,
	);

	test(
		"a failed test embedding stores nothing and says why",
		async () => {
			const { admin } = await actors();
			const { procedures, options } = await call(admin, indexes.failures);
			const save = (baseUrl: string, apiKey = API_KEY) =>
				reasonOf(
					run(
						procedures.instanceSettings.updateEmbeddings(
							{
								baseUrl,
								apiKey,
								model: "integration-embedding",
							},
							options,
						),
					),
				);

			// A blank key stands for the stored one, and there is none yet.
			expect(await save(endpoint("ok"), "")).toBe("EMBEDDING_API_KEY_REQUIRED");
			expect(await save(endpoint("unauthorized"))).toBe(
				"EMBEDDING_KEY_REJECTED",
			);
			expect(await save(endpoint("missing-model"))).toBe(
				"EMBEDDING_MODEL_NOT_FOUND",
			);
			expect(await save(endpoint("garbage"))).toBe(
				"EMBEDDING_RESPONSE_INVALID",
			);
			expect(await save(UNREACHABLE)).toBe("EMBEDDING_ENDPOINT_UNREACHABLE");
			expect(
				(await run(procedures.instanceSettings.find({}, options))).data,
			).toEqual({
				embeddings: null,
			});
		},
		TIMEOUT,
	);

	test(
		"the first save reads the dimensions from the test vector and never hands the key back; a later one with the same model keeps the generation",
		async () => {
			const { admin } = await actors();
			const { procedures, options } = await call(admin, indexes.saves);
			const saved = await run(
				procedures.instanceSettings.updateEmbeddings(
					{
						baseUrl: endpoint("ok"),
						apiKey: API_KEY,
						model: "integration-embedding",
					},
					options,
				),
			);
			const found = await run(procedures.instanceSettings.find({}, options));
			const generation = () =>
				run(
					embeddingSettings.pipe(
						Effect.provideService(EmbeddingIndex, indexes.saves),
					),
				);
			const stored = await generation();

			expect(saved.data).toEqual({
				generation: Number(stored?.generation),
				baseUrl: endpoint("ok"),
				model: "integration-embedding",
				dimensions: DIMENSIONS,
				apiKeySet: true,
			});
			expect(found.data.embeddings).toEqual(saved.data);
			expect(
				JSON.stringify([
					saved,
					found,
				]),
			).not.toContain(API_KEY);
			const [row] = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select({
							key: indexes.saves.settings.embeddingApiKeyEncrypted,
						})
						.from(indexes.saves.settings);
				}),
			);
			expect(row?.key).not.toContain(API_KEY);

			// The same model on another endpoint, keeping the stored key.
			await run(
				procedures.instanceSettings.updateEmbeddings(
					{
						baseUrl: endpoint("ok-too"),
						model: "integration-embedding",
					},
					options,
				),
			);
			expect(await generation()).toEqual(
				stored && {
					...stored,
					baseUrl: endpoint("ok-too"),
				},
			);
		},
		TIMEOUT,
	);

	test(
		"another model, or the same one with other dimensions, re-embeds only once confirmed, into a new generation",
		async () => {
			const { admin } = await actors();
			const { procedures, options } = await call(admin, indexes.changes);
			const save = (
				baseUrl: string,
				model: string,
				reembedGeneration?: number,
			) =>
				run(
					procedures.instanceSettings.updateEmbeddings(
						{
							baseUrl,
							apiKey: API_KEY,
							model,
							reembedGeneration,
						},
						options,
					),
				);
			const settings = () =>
				run(
					embeddingSettings.pipe(
						Effect.provideService(EmbeddingIndex, indexes.changes),
					),
				);
			await save(endpoint("ok"), "integration-embedding");
			const first = await settings();

			expect(await reasonOf(save(endpoint("ok"), "another-embedding"))).toBe(
				"EMBEDDING_MODEL_CHANGE_UNCONFIRMED",
			);
			// Same name, more dimensions: another model all the same.
			expect(
				await reasonOf(save(endpoint("wide"), "integration-embedding")),
			).toBe("EMBEDDING_MODEL_CHANGE_UNCONFIRMED");
			expect(await settings()).toEqual(first);

			await save(endpoint("wide"), "integration-embedding", first?.generation);
			const wide = await settings();
			expect(wide).toMatchObject({
				model: "integration-embedding",
				dimensions: WIDE_DIMENSIONS,
			});
			expect(wide?.generation).toBeGreaterThan(first?.generation ?? 0);
			expect(wide?.collection).not.toBe(first?.collection);

			// Confirmed for a generation that is gone: the admin confirms again.
			expect(
				await reasonOf(
					save(endpoint("ok"), "another-embedding", first?.generation),
				),
			).toBe("EMBEDDING_SETTING_CHANGED");
			expect(await settings()).toEqual(wide);

			await save(endpoint("ok"), "another-embedding", wide?.generation);
			const another = await settings();
			expect(another).toMatchObject({
				model: "another-embedding",
				dimensions: DIMENSIONS,
			});
			expect(another?.generation).toBeGreaterThan(wide?.generation ?? 0);
			// No repository holds a file, so nothing is left to rebuild.
			expect(
				(await run(procedures.instanceSettings.embeddingsStatus({}, options)))
					.data.rebuilding,
			).toBe(false);
			expect(
				(await run(procedures.instanceSettings.embeddingProgress({}, options)))
					.data,
			).toEqual({
				generation: Number(another?.generation),
				rebuilding: false,
				organizations: [],
				failures: [],
				retryable: 0,
			});
		},
		TIMEOUT,
	);

	test(
		"two admins confirming different models for the same generation: one switches, the other is told to confirm again",
		async () => {
			const { admin } = await actors();
			const { procedures, options } = await call(admin, indexes.confirming);
			const save = (model: string, reembedGeneration?: number) =>
				run(
					procedures.instanceSettings.updateEmbeddings(
						{
							baseUrl: endpoint("ok"),
							apiKey: API_KEY,
							model,
							reembedGeneration,
						},
						options,
					),
				);
			const settings = () =>
				run(
					embeddingSettings.pipe(
						Effect.provideService(EmbeddingIndex, indexes.confirming),
					),
				);
			await save("integration-embedding");
			const confirmed = (await settings())?.generation;

			const outcomes = await Promise.all([
				reasonOf(save("model-b", confirmed)),
				reasonOf(save("model-c", confirmed)),
			]);
			expect(outcomes.filter((reason) => reason === undefined)).toHaveLength(1);
			expect(outcomes).toContain("EMBEDDING_SETTING_CHANGED");
			const after = await settings();
			expect(after?.model).toBe(
				outcomes[0] === undefined ? "model-b" : "model-c",
			);
			expect(after?.generation).toBeGreaterThan(confirmed ?? 0);
		},
		TIMEOUT,
	);

	test(
		"two admins confirming the same model on different endpoints for the same generation: the later one changes nothing",
		async () => {
			const { admin } = await actors();
			const { procedures, options } = await call(admin, indexes.sameTarget);
			const save = (baseUrl: string, reembedGeneration?: number) =>
				run(
					procedures.instanceSettings.updateEmbeddings(
						{
							baseUrl,
							apiKey: API_KEY,
							model: reembedGeneration ? "model-b" : "integration-embedding",
							reembedGeneration,
						},
						options,
					),
				);
			const settings = () =>
				run(
					embeddingSettings.pipe(
						Effect.provideService(EmbeddingIndex, indexes.sameTarget),
					),
				);
			await save(endpoint("ok"));
			const confirmed = (await settings())?.generation;

			const outcomes = await Promise.all([
				reasonOf(save(endpoint("first"), confirmed)),
				reasonOf(save(endpoint("second"), confirmed)),
			]);
			expect(outcomes.filter((reason) => reason === undefined)).toHaveLength(1);
			expect(outcomes).toContain("EMBEDDING_SETTING_CHANGED");
			expect(await settings()).toMatchObject({
				model: "model-b",
				baseUrl: endpoint(outcomes[0] === undefined ? "first" : "second"),
			});
		},
		TIMEOUT,
	);

	test(
		"Re-embed everything starts a generation of the same model once, however often it is sent",
		async () => {
			const { admin } = await actors();
			const { procedures, options } = await call(admin, indexes.reembed);
			const settings = () =>
				run(
					embeddingSettings.pipe(
						Effect.provideService(EmbeddingIndex, indexes.reembed),
					),
				);
			const reembed = (generation: number) =>
				run(
					procedures.instanceSettings.reembedEmbeddings(
						{
							generation,
						},
						options,
					),
				);
			expect(await reasonOf(reembed(1))).toBe("EMBEDDINGS_NOT_CONFIGURED");
			await run(
				procedures.instanceSettings.updateEmbeddings(
					{
						baseUrl: endpoint("ok"),
						apiKey: API_KEY,
						model: "integration-embedding",
					},
					options,
				),
			);
			const before = await settings();
			const generation = before?.generation ?? 0;

			const [first, second] = await Promise.all([
				reembed(generation),
				reembed(generation),
			]);
			expect(
				[
					first.data.started,
					second.data.started,
				].sort(),
			).toEqual([
				false,
				true,
			]);
			const after = await settings();
			expect(after).toMatchObject({
				baseUrl: before?.baseUrl,
				model: before?.model,
				dimensions: before?.dimensions,
			});
			expect(after?.generation).toBeGreaterThan(generation);
			expect(after?.collection).not.toBe(before?.collection);
		},
		TIMEOUT,
	);

	test(
		"discovery lists an endpoint's models, and an endpoint without a list leaves the name to the admin",
		async () => {
			const { admin } = await actors();
			const { procedures, options } = await call(admin, indexes.discovery);
			const discover = (baseUrl: string) =>
				run(
					procedures.instanceSettings.discoverEmbeddingModels(
						{
							baseUrl,
							apiKey: API_KEY,
						},
						options,
					),
				);

			expect((await discover(endpoint("ok"))).data).toEqual({
				models: [
					"integration-embedding",
				],
				listed: true,
			});
			expect((await discover(endpoint("missing-model"))).data).toEqual({
				models: [],
				listed: false,
			});
			expect(await reasonOf(discover(endpoint("unauthorized")))).toBe(
				"PROVIDER_MODELS_KEY_REJECTED",
			);
		},
		TIMEOUT,
	);

	test(
		"a save that tested the stored key stores that key, even when another save replaced it meanwhile",
		async () => {
			const { admin } = await actors();
			const { procedures, options } = await call(admin, indexes.racing);
			const save = (baseUrl: string, apiKey?: string) =>
				run(
					procedures.instanceSettings.updateEmbeddings(
						{
							baseUrl,
							apiKey,
							model: "integration-embedding",
						},
						options,
					),
				);
			await save(endpoint("ok"), "sk-first");

			const reached = Promise.withResolvers<string | null>();
			const release = Promise.withResolvers<void>();
			held = {
				reached: reached.resolve,
				release: release.promise,
			};
			// A blank key: the test embedding runs with the stored one.
			const testing = save(endpoint("held"));
			expect(await reached.promise).toBe("Bearer sk-first");
			await save(endpoint("ok"), "sk-second");
			release.resolve();
			await testing;

			const stored = await run(
				Effect.all([
					embeddingSettings,
					storedEmbeddingApiKey,
				]).pipe(Effect.provideService(EmbeddingIndex, indexes.racing)),
			);
			expect([
				stored[0]?.baseUrl,
				stored[1],
			]).toEqual([
				endpoint("held"),
				"sk-first",
			]);
		},
		TIMEOUT,
	);
});
