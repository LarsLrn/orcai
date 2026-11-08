import { describe, expect, mock, test } from "bun:test";
import * as Effect from "effect/Effect";
import { testAppConfig } from "@/lib/testing/app-config";

/** What Better Auth answers for the request cookie; `null` is a signed-out visitor. */
let session: {
	session: Record<string, unknown>;
	user: Record<string, unknown>;
} | null = null;

mock.module("@/lib/auth/auth", () => ({
	auth: {
		api: {
			getSession: () => Promise.resolve(session),
		},
	},
}));
mock.module("@/lib/images/images", () => ({
	imageResponse: () => Effect.succeed(new Response("image")),
}));
/** The signed-in user's ready export, if any. */
let archive:
	| {
			bucket: string;
			key: string;
			completedAt: Date;
	  }
	| undefined;

mock.module("@/lib/data-export/data-export", () => ({
	downloadableDataExport: () => Effect.succeed(archive),
}));
mock.module("@orcai/s3/server", () => ({
	getDownloadUrl: (params: { key: string }) =>
		Effect.succeed(`https://storage.test/${params.key}?signed`),
}));

const { AppConfigService } = await import("@/lib/effect/services/config");

mock.module("@/lib/effect/runtime", () => ({
	runPromise: (effect: Effect.Effect<Response, unknown, never>) =>
		Effect.runPromise(
			effect.pipe(
				Effect.provideService(
					AppConfigService,
					testAppConfig({
						twoFactorPolicy: "all",
					}),
				),
			),
		),
}));

const images = (await import("./images/$")).Route;
const dataExports = (await import("./data-exports/$dataExportId")).Route;

const signedInAs = (twoFactorEnabled: boolean) => {
	session = {
		session: {
			id: "session-1",
			activeOrganizationId: null,
		},
		user: {
			id: "7b6d7c0e-2a3f-4c1d-9e8f-0a1b2c3d4e5f",
			role: "user",
			twoFactorEnabled,
		},
	};
};

type Handler = (context: {
	request: Request;
	params: Record<string, string>;
}) => Promise<Response>;

const get = (
	route: {
		options: unknown;
	},
	params: Record<string, string>,
) =>
	(
		route.options as {
			server: {
				handlers: {
					GET: Handler;
				};
			};
		}
	).server.handlers.GET({
		request: new Request("http://app.test/api"),
		params,
	});

const statuses = async () => [
	(
		await get(images, {
			_splat: "users/picture.png",
		})
	).status,
	(
		await get(dataExports, {
			dataExportId: "7b6d7c0e-2a3f-4c1d-9e8f-0a1b2c3d4e5f",
		})
	).status,
];

describe("signed-in HTTP routes", () => {
	test("refuse a signed-out request", async () => {
		session = null;

		expect(await statuses()).toEqual([
			401,
			401,
		]);
	});

	test("refuse a session the two-factor policy refuses, as procedures do", async () => {
		signedInAs(false);

		expect(await statuses()).toEqual([
			403,
			403,
		]);
	});

	test("answer a user with a second factor", async () => {
		signedInAs(true);

		expect(await statuses()).toEqual([
			200,
			404,
		]);
	});

	test("send the owner of a ready export to its signed archive", async () => {
		signedInAs(true);
		archive = {
			bucket: "exports",
			key: "export.zip",
			completedAt: new Date("2026-11-03T00:00:00Z"),
		};

		const response = await get(dataExports, {
			dataExportId: "7b6d7c0e-2a3f-4c1d-9e8f-0a1b2c3d4e5f",
		});
		archive = undefined;

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"https://storage.test/export.zip?signed",
		);
	});
});
