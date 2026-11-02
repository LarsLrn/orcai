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
 * models, `/held` too once the test lets it, the others fail the way their
 * name says.
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
							length: DIMENSIONS,
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
		"only instance admins read, change and list embedding models; anyone signed in sees whether search works",
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
				(await run(procedures.instanceSettings.embeddingsStatus({}, options)))
					.data,
			).toEqual({
				configured: false,
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
		"the first save reads the dimensions from the test vector and never hands the key back; a later one keeps the generation and refuses another model",
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
			expect(
				await reasonOf(
					run(
						procedures.instanceSettings.updateEmbeddings(
							{
								baseUrl: endpoint("ok"),
								model: "another-embedding",
							},
							options,
						),
					),
				),
			).toBe("EMBEDDING_MODEL_CHANGE_UNSUPPORTED");
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
