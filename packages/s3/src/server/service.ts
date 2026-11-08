import { S3Client } from "@aws-sdk/client-s3";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { createMissingBuckets } from "./buckets";
import { presignEndpoint, S3ConfigLive, S3ConfigService } from "./config";
import { S3Error } from "./errors";

export class S3Service extends Context.Service<
	S3Service,
	{
		readonly client: S3Client;
		readonly presignClient: S3Client;
		/** Creates missing buckets on its first success, then does nothing. */
		readonly ensureBuckets: Effect.Effect<void, S3Error>;
	}
>()("S3Service") {}

const acquireClients = Effect.acquireRelease(
	Effect.gen(function* () {
		const { config } = yield* S3ConfigService;
		const sharedClientOptions = {
			region: config.region,
			credentials: {
				accessKeyId: Redacted.value(config.accessKey),
				secretAccessKey: Redacted.value(config.secretKey),
			},
			forcePathStyle: true,
			// Default checksums end up in presigned URLs, which SeaweedFS rejects.
			requestChecksumCalculation: "WHEN_REQUIRED",
			responseChecksumValidation: "WHEN_REQUIRED",
		} as const;

		return yield* Effect.try({
			try: () => {
				const client = new S3Client({
					...sharedClientOptions,
					endpoint: config.endpoint,
				});
				const endpoint = presignEndpoint(config);
				const presignClient =
					endpoint === config.endpoint
						? client
						: new S3Client({
								...sharedClientOptions,
								endpoint,
							});

				return {
					client,
					presignClient,
				};
			},
			catch: (cause) =>
				new S3Error({
					operation: "start",
					cause,
				}),
		});
	}),
	({ client, presignClient }) =>
		Effect.sync(() => {
			client.destroy();
			if (presignClient !== client) {
				presignClient.destroy();
			}
		}),
);

const S3ServiceLive = Layer.effect(
	S3Service,
	Effect.gen(function* () {
		const clients = yield* acquireClients;
		const ensureBuckets = yield* Effect.cachedWithTTL(
			createMissingBuckets(clients.client),
			(exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero),
		);
		return {
			...clients,
			ensureBuckets,
		};
	}),
);

/** Makes sure every bucket exists; checks storage once per process. */
export const ensureBuckets = Effect.gen(function* () {
	const { ensureBuckets } = yield* S3Service;
	yield* ensureBuckets;
});

export const S3Live = S3ServiceLive.pipe(Layer.provide(S3ConfigLive));
