import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const valkeyConfig = Config.all({
	valkey: Config.all({
		url: Config.string("VALKEY_URL"),
	}),
});

export type ValkeyConfig = Config.Config.Success<typeof valkeyConfig>;

export class ValkeyConfigService extends Context.Tag("ValkeyConfigService")<
	ValkeyConfigService,
	{
		readonly config: ValkeyConfig;
	}
>() {}

export const ValkeyConfigLive = Layer.effect(
	ValkeyConfigService,
	valkeyConfig.pipe(
		Effect.map((config) => ({
			config,
		})),
	),
);
