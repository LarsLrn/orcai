import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const valkeyConfig = Config.all({
	valkey: Config.all({
		url: Config.string("VALKEY_URL"),
	}),
});

export type ValkeyConfig = Config.Success<typeof valkeyConfig>;

export class ValkeyConfigService extends Context.Service<
	ValkeyConfigService,
	{
		readonly config: ValkeyConfig;
	}
>()("ValkeyConfigService") {}

export const ValkeyConfigLive = Layer.effect(
	ValkeyConfigService,
	Effect.gen(function* () {
		const config = yield* valkeyConfig;

		return {
			config,
		};
	}),
);
