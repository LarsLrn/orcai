import { expect, test } from "bun:test";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { presignOrigin, S3ConfigLive } from "../src/server";

const originFor = (endpoints: Record<string, string>) =>
	Effect.runPromise(
		presignOrigin.pipe(
			Effect.provide(S3ConfigLive),
			Effect.provideService(
				ConfigProvider.ConfigProvider,
				ConfigProvider.fromUnknown({
					S3_ACCESS_KEY: "access",
					S3_SECRET_KEY: "secret",
					...endpoints,
				}),
			),
		),
	);

test("browsers reach storage at the public endpoint's origin", async () => {
	expect(
		await originFor({
			S3_ENDPOINT: "http://seaweedfs:8333",
			S3_PUBLIC_ENDPOINT: "https://storage.example/s3/",
		}),
	).toBe("https://storage.example");
});

test("an unset or blank public endpoint falls back to the endpoint", async () => {
	expect(
		await originFor({
			S3_ENDPOINT: "http://localhost:8333/",
		}),
	).toBe("http://localhost:8333");
	expect(
		await originFor({
			S3_ENDPOINT: "http://localhost:8333",
			S3_PUBLIC_ENDPOINT: "  ",
		}),
	).toBe("http://localhost:8333");
});

test("a padded public endpoint is trimmed", async () => {
	expect(
		await originFor({
			S3_ENDPOINT: "http://seaweedfs:8333",
			S3_PUBLIC_ENDPOINT: " https://storage.example:9000 ",
		}),
	).toBe("https://storage.example:9000");
});
