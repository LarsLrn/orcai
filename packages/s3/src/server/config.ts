import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

const normalizeOptionalString = (
	value: Option.Option<string>,
): Option.Option<string> =>
	Option.match(value, {
		onNone: () => Option.none(),
		onSome: (resolved) => {
			const trimmed = resolved.trim();
			return trimmed.length === 0 ? Option.none() : Option.some(trimmed);
		},
	});

const s3Config = Config.all({
	region: Config.withDefault(Config.string("S3_REGION"), "eu-central-1"),
	endpoint: Config.string("S3_ENDPOINT"),
	publicEndpoint: Config.option(Config.string("S3_PUBLIC_ENDPOINT")),
	accessKey: Config.redacted("S3_ACCESS_KEY"),
	secretKey: Config.redacted("S3_SECRET_KEY"),
}).pipe(
	Config.map((raw) => ({
		...raw,
		publicEndpoint: normalizeOptionalString(raw.publicEndpoint),
	})),
);

export type S3Config = Config.Config.Success<typeof s3Config>;

export class S3ConfigService extends Context.Tag("S3ConfigService")<
	S3ConfigService,
	{
		readonly config: S3Config;
	}
>() {}

export const S3ConfigLive = Layer.effect(
	S3ConfigService,
	s3Config.pipe(
		Effect.map((config) => ({
			config,
		})),
	),
);
