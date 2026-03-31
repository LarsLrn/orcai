import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ParseResult from "effect/ParseResult";
import * as Schema from "effect/Schema";

const spiceDbSecurityModes = [
	"secure",
	"insecure-localhost",
	"insecure-plaintext",
] as const;

export type SpiceDbSecurityMode = (typeof spiceDbSecurityModes)[number];

const SpiceDbSecurityModeLiteralSchema = Schema.Literal(
	...spiceDbSecurityModes,
);

const SpiceDbSecurityModeSchema = Schema.transformOrFail(
	Schema.String,
	SpiceDbSecurityModeLiteralSchema,
	{
		strict: true,
		decode: (value, _options, ast) => {
			const normalized = value.trim().toLowerCase();

			return spiceDbSecurityModes.includes(normalized as SpiceDbSecurityMode)
				? ParseResult.succeed(normalized as SpiceDbSecurityMode)
				: ParseResult.fail(
						new ParseResult.Type(
							ast,
							value,
							`Expected one of: ${spiceDbSecurityModes.join(", ")}`,
						),
					);
		},
		encode: (value) => ParseResult.succeed(value),
	},
);

const spiceConfig = Config.all({
	spice: Config.all({
		endpoint: Config.string("SPICEDB_ENDPOINT"),
		token: Config.redacted("SPICEDB_TOKEN"),
		security: Config.withDefault(
			Schema.Config("SPICEDB_SECURITY", SpiceDbSecurityModeSchema),
			"insecure-plaintext",
		),
	}),
});

type SpiceDbConfig = Config.Config.Success<typeof spiceConfig>;

export class SpiceDbConfigService extends Context.Tag("SpiceDbConfigService")<
	SpiceDbConfigService,
	{
		readonly config: SpiceDbConfig;
	}
>() {}

export const SpiceDbConfigLive = Layer.effect(
	SpiceDbConfigService,
	spiceConfig.pipe(
		Effect.map((config) => ({
			config,
		})),
	),
);
