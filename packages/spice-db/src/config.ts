import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";

const spiceDbSecurityModes = [
	"secure",
	"insecure-localhost",
	"insecure-plaintext",
] as const;

export type SpiceDbSecurityMode = (typeof spiceDbSecurityModes)[number];

const SpiceDbSecurityModeLiteralSchema = Schema.Literals(spiceDbSecurityModes);

const SpiceDbSecurityModeSchema = Schema.String.pipe(
	Schema.decodeTo(SpiceDbSecurityModeLiteralSchema, {
		decode: SchemaGetter.transformOrFail((value: string) => {
			const normalized = value.trim().toLowerCase();

			if (spiceDbSecurityModes.includes(normalized as SpiceDbSecurityMode)) {
				return Effect.succeed(normalized as SpiceDbSecurityMode);
			}

			return Effect.fail(
				new SchemaIssue.InvalidValue({
					expected: spiceDbSecurityModes.join(" | "),
				}),
			);
		}),
		encode: SchemaGetter.transform((value: SpiceDbSecurityMode) => value),
	}),
);

const spiceConfig = Config.all({
	spice: Config.all({
		endpoint: Config.string("SPICEDB_ENDPOINT"),
		token: Config.redacted("SPICEDB_TOKEN"),
		security: Config.withDefault(
			Config.schema(SpiceDbSecurityModeSchema, "SPICEDB_SECURITY"),
			"insecure-plaintext",
		),
	}),
});

type SpiceDbConfig = Config.Success<typeof spiceConfig>;

export class SpiceDbConfigService extends Context.Service<
	SpiceDbConfigService,
	{
		readonly config: SpiceDbConfig;
	}
>()("SpiceDbConfigService") {}

export const SpiceDbConfigLive = Layer.effect(
	SpiceDbConfigService,
	Effect.gen(function* () {
		const config = yield* spiceConfig;

		return {
			config,
		};
	}),
);
