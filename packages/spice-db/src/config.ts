import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

const spiceDbSecurityModes = [
	"secure",
	"insecure-localhost",
	"insecure-plaintext",
] as const;

export type SpiceDbSecurityMode = (typeof spiceDbSecurityModes)[number];

const SpiceDbSecurityModeSchema = Schema.String.pipe(
	Schema.decode(SchemaTransformation.trim()),
	Schema.decode(SchemaTransformation.toLowerCase()),
	Schema.decodeTo(Schema.Literals(spiceDbSecurityModes)),
);

const spiceDbConfig = Config.all({
	endpoint: Config.String("SPICEDB_ENDPOINT"),
	token: Config.Redacted("SPICEDB_TOKEN"),
	security: Config.withDefault(
		Config.schema(SpiceDbSecurityModeSchema, "SPICEDB_SECURITY"),
		"insecure-plaintext",
	),
	readTimeout: Config.withDefault(
		Config.Duration("SPICEDB_READ_TIMEOUT"),
		Duration.seconds(5),
	),
});

type SpiceDbConfig = Config.Success<typeof spiceDbConfig>;

export class SpiceDbConfigService extends Context.Service<
	SpiceDbConfigService,
	{
		readonly config: SpiceDbConfig;
	}
>()("SpiceDbConfigService") {}

export const SpiceDbConfigLive = Layer.effect(
	SpiceDbConfigService,
	Effect.map(spiceDbConfig, (config) => ({
		config,
	})),
);
