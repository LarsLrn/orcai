import { S3Client } from "@aws-sdk/client-s3";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { S3Error } from "@/lib/effect/utils/errors";
import { AppConfigService } from "./config";

export class S3Service extends Context.Tag("S3Service")<
	S3Service,
	{
		readonly client: S3Client;
		readonly presignClient: S3Client;
	}
>() {}

export const S3Live = Layer.scoped(
	S3Service,
	Effect.acquireRelease(
		Effect.gen(function* () {
			const { config } = yield* AppConfigService;
			const sharedClientOptions = {
				region: config.s3.region,
				credentials: {
					accessKeyId: Redacted.value(config.s3.accessKey),
					secretAccessKey: Redacted.value(config.s3.secretKey),
				},
				forcePathStyle: true,
			} as const;

			return yield* Effect.try({
				try: () => {
					const client = new S3Client({
						...sharedClientOptions,
						endpoint: config.s3.endpoint,
					});
					const presignEndpoint = Option.getOrElse(
						config.s3.publicEndpoint,
						() => config.s3.endpoint,
					);

					const presignClient =
						presignEndpoint === config.s3.endpoint
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
				catch: (error) =>
					new S3Error({
						operation: "start",
						cause: error,
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
