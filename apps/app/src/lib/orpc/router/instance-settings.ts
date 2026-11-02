import {
	type EmbeddingTestFailure,
	listProviderModels,
	ModelListingError,
	type ModelListingFailure,
	testEmbedding,
} from "@orcai/ai";
import { sendJobBatch } from "@orcai/pg-boss";
import {
	configureEmbeddings,
	embeddingSettings,
	storedEmbeddingApiKey,
} from "@orcai/qdrant";
import { type ErrorReason, RECONCILE_EMBEDDINGS_JOB_NAME } from "@orcai/schema";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireInstanceAdminMiddleware } from "@/lib/orpc/middlewares/auth";

const TEST_FAILURE_REASONS = {
	"key-rejected": "EMBEDDING_KEY_REJECTED",
	unreachable: "EMBEDDING_ENDPOINT_UNREACHABLE",
	"model-not-found": "EMBEDDING_MODEL_NOT_FOUND",
	"invalid-response": "EMBEDDING_RESPONSE_INVALID",
} as const satisfies Record<EmbeddingTestFailure, ErrorReason>;

const LISTING_FAILURE_REASONS = {
	unauthorized: "PROVIDER_MODELS_KEY_REJECTED",
	unsupported: "PROVIDER_MODELS_LISTING_UNSUPPORTED",
	unreachable: "PROVIDER_MODELS_UNREACHABLE",
	"invalid-response": "PROVIDER_MODELS_RESPONSE_INVALID",
} as const satisfies Record<ModelListingFailure, ErrorReason>;

/** The key a request brings, else the stored one. */
const apiKeyOf = (apiKey: string | undefined) =>
	Effect.gen(function* () {
		const key = apiKey ?? (yield* storedEmbeddingApiKey);
		if (key === undefined) {
			return yield* new AppErrors.BadRequestError({
				reason: "EMBEDDING_API_KEY_REQUIRED",
				message: "The first embedding setup needs an API key",
			});
		}
		return key;
	});

const currentEmbeddings = embeddingSettings.pipe(
	Effect.map((settings) =>
		settings
			? {
					baseUrl: settings.baseUrl,
					model: settings.model,
					dimensions: settings.dimensions,
					apiKeySet: true,
				}
			: null,
	),
);

const find = authed.instanceSettings.find
	.use(requireInstanceAdminMiddleware)
	.effect(function* () {
		return {
			data: {
				embeddings: yield* currentEmbeddings,
			},
		};
	});

const embeddingsStatus = authed.instanceSettings.embeddingsStatus.effect(
	function* () {
		return {
			data: {
				configured: (yield* embeddingSettings) !== undefined,
			},
		};
	},
);

const discoverEmbeddingModels = authed.instanceSettings.discoverEmbeddingModels
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const apiKey = yield* apiKeyOf(input.apiKey);
		const listed = yield* Effect.tryPromise({
			try: () =>
				listProviderModels("openai-compatible", {
					apiKey,
					endpoint: input.baseUrl,
				}),
			catch: (cause) => cause,
		}).pipe(
			Effect.catch((cause) =>
				cause instanceof ModelListingError && cause.failure === "unsupported"
					? Effect.succeed(undefined)
					: Effect.fail(
							new AppErrors.BadRequestError({
								reason:
									cause instanceof ModelListingError
										? LISTING_FAILURE_REASONS[cause.failure]
										: "PROVIDER_MODELS_FETCH_FAILED",
								message: "Failed to list the embedding endpoint's models",
								cause,
							}),
						),
			),
		);

		return {
			data: {
				// Endpoints that report capabilities name their embedding models; the others list everything.
				models: (listed ?? [])
					.filter(
						(model) =>
							model.capabilities === null ||
							model.capabilities.includes("embedding"),
					)
					.map((model) => model.providerModelId)
					.sort(),
				listed: listed !== undefined,
			},
		};
	});

const updateEmbeddings = authed.instanceSettings.updateEmbeddings
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		// The key the test embedding used is the one stored, even if another save changed it meanwhile.
		const apiKey = yield* apiKeyOf(input.apiKey);
		const dimensions = yield* testEmbedding({
			baseUrl: input.baseUrl,
			apiKey,
			model: input.model,
		}).pipe(
			Effect.mapError(
				(cause) =>
					new AppErrors.BadRequestError({
						reason: TEST_FAILURE_REASONS[cause.failure],
						message: "The test embedding failed",
						cause,
					}),
			),
		);
		yield* configureEmbeddings({
			baseUrl: input.baseUrl,
			apiKey,
			model: input.model,
			dimensions,
		}).pipe(
			Effect.catchTag("EmbeddingModelChangeError", (cause) =>
				Effect.fail(
					new AppErrors.ConflictError({
						reason: "EMBEDDING_MODEL_CHANGE_UNSUPPORTED",
						message: "The embedding model cannot be changed yet",
						cause,
					}),
				),
			),
		);
		// The reconciler's schedule catches up when the wake-up cannot be queued.
		yield* sendJobBatch({
			jobName: RECONCILE_EMBEDDINGS_JOB_NAME,
			jobs: [
				{
					data: {},
				},
			],
		}).pipe(
			Effect.catch((error) =>
				Effect.logWarning(
					{
						error,
					},
					"Could not wake the embedding reconciler",
				),
			),
		);

		return {
			data: {
				baseUrl: input.baseUrl,
				model: input.model,
				dimensions,
				apiKeySet: true,
			},
		};
	});

export const instanceSettingsRouter = {
	find,
	embeddingsStatus,
	discoverEmbeddingModels,
	updateEmbeddings,
};
