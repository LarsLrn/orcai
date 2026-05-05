import { S3Client } from "@aws-sdk/client-s3";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { S3ConfigLive, S3ConfigService } from "./config";
import { S3Error } from "./errors";

export class S3Service extends Context.Service<
	S3Service,
	{
		readonly client: S3Client;
		readonly presignClient: S3Client;
	}
>()("S3Service") {}

export const S3ServiceLive = Layer.effect(
	S3Service,
	Effect.acquireRelease(
		Effect.gen(function* () {
			const { config } = yield* S3ConfigService;
			const sharedClientOptions = {
				region: config.region,
				credentials: {
					accessKeyId: Redacted.value(config.accessKey),
					secretAccessKey: Redacted.value(config.secretKey),
				},
				forcePathStyle: true,
			} as const;

			return yield* Effect.try({
				try: () => {
					const client = new S3Client({
						...sharedClientOptions,
						endpoint: config.endpoint,
					});
					const presignEndpoint = Option.getOrElse(
						config.publicEndpoint,
						() => config.endpoint,
					);

					const presignClient =
						presignEndpoint === config.endpoint
							? client
							: new S3Client({
									...sharedClientOptions,
									endpoint: presignEndpoint,
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
	),
);

export const S3Live = S3ServiceLive.pipe(Layer.provide(S3ConfigLive));
