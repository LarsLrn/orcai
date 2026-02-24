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
	{ readonly client: S3Client }
>() {}

export const S3Live = Layer.scoped(
	S3Service,
	Effect.acquireRelease(
		Effect.gen(function* () {
			const { config } = yield* AppConfigService;

			return yield* Effect.try({
				try: () => ({
					client: new S3Client({
						region: Option.getOrUndefined(config.s3.region),
						endpoint: config.s3.endpoint,
						credentials: {
							accessKeyId: Redacted.value(config.s3.accessKey),
							secretAccessKey: Redacted.value(config.s3.secretKey),
						},
						forcePathStyle: true,
					}),
				}),
				catch: (error) => new S3Error({ operation: "start", cause: error }),
			});
		}),
		({ client }) => Effect.sync(() => client.destroy()),
	),
);
