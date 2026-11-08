import { describe, expect, test } from "bun:test";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Redacted from "effect/Redacted";
import { SpiceDbConfigLive, SpiceDbConfigService } from "../src";

const load = (env: Record<string, string>) =>
	Effect.runPromiseExit(
		Effect.service(SpiceDbConfigService).pipe(
			Effect.provide(SpiceDbConfigLive),
			Effect.provideService(
				ConfigProvider.ConfigProvider,
				ConfigProvider.fromEnv({
					env: {
						SPICEDB_ENDPOINT: "spicedb:50051",
						SPICEDB_TOKEN: "token",
						...env,
					},
				}),
			),
		),
	);

describe("SpiceDbConfigLive", () => {
	test("defaults to plaintext with a five second read timeout", async () => {
		const exit = await load({});

		expect(Exit.isSuccess(exit)).toBe(true);
		if (!Exit.isSuccess(exit)) return;
		const { config } = exit.value;
		expect(config.endpoint).toBe("spicedb:50051");
		expect(Redacted.value(config.token)).toBe("token");
		expect(config.security).toBe("insecure-plaintext");
		expect(Duration.toMillis(config.readTimeout)).toBe(5_000);
	});

	test("reads the security mode regardless of case and surrounding space", async () => {
		const exit = await load({
			SPICEDB_SECURITY: "  Insecure-Localhost ",
		});

		expect(Exit.isSuccess(exit) && exit.value.config.security).toBe(
			"insecure-localhost",
		);
	});

	test("rejects an unknown security mode", async () => {
		const exit = await load({
			SPICEDB_SECURITY: "tls",
		});

		expect(Exit.isFailure(exit)).toBe(true);
	});
});
