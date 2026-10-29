import { afterAll, describe, expect, test } from "bun:test";
import { serve } from "bun";
import { authzIntegration, TIMEOUT } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions } = authzIntegration();

const openRouterModel = (id: string, supportedParameters: string[]) => ({
	id,
	name: id,
	created: 0,
	context_length: 8_192,
	architecture: {
		modality: "text->text",
		input_modalities: [
			"text",
		],
		output_modalities: [
			"text",
		],
		tokenizer: "Other",
		instruct_type: null,
	},
	supported_parameters: supportedParameters,
	top_provider: {
		is_moderated: false,
	},
});

/** `GET /models` of an endpoint, answering with whatever `listing` holds. */
let listing: unknown[] = [];
const server = serve({
	port: 0,
	fetch: (request) =>
		new URL(request.url).pathname === "/v1/models"
			? Response.json({
					object: "list",
					data: listing,
				})
			: new Response("not found", {
					status: 404,
				}),
});
afterAll(() => server.stop(true));

describe("model discovery", () => {
	test(
		"stores reported capabilities, leaves unreported ones unset and keeps an admin's on rediscovery",
		async () => {
			const {
				actors: [admin],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const procedures = await run(Procedures);
			const options = await procedureOptions(admin, zedToken);
			const { data: provider } = await run(
				procedures.provider.create(
					{
						name: `Discovery ${crypto.randomUUID()}`,
						description: "Created by the discovery test.",
						kind: "openai-compatible",
						endpoint: `${server.url.origin}/v1`,
						apiKey: "key",
						meteringMode: "tokens",
						enabled: true,
					},
					options,
				),
			);
			const discover = async () =>
				(
					await run(
						procedures.model.discover(
							{
								providerId: provider.id,
							},
							options,
						),
					)
				).data;
			const models = async (capabilitiesSet?: boolean) =>
				Object.fromEntries(
					(
						await run(
							procedures.model.list(
								{
									pageIndex: 0,
									pageSize: 10,
									filters: {
										providerId: provider.id,
										capabilitiesSet,
									},
								},
								options,
							),
						)
					).data.map((model) => [
						model.providerModelId,
						model,
					]),
				);
			const chatModelCheck = async () =>
				(
					await run(procedures.readiness.organization({}, options))
				).data.checks.find((check) => check.id === "chat-model");

			listing = [
				{
					id: "plain",
					object: "model",
					created: 0,
					owned_by: "someone",
				},
				openRouterModel("text-only", [
					"max_tokens",
				]),
			];
			expect(await discover()).toEqual({
				foundCount: 2,
				addedCount: 2,
				alreadyExistedCount: 0,
				capabilitiesUnsetCount: 1,
			});
			expect(await models()).toMatchObject({
				plain: {
					capabilities: null,
				},
				"text-only": {
					capabilities: [
						"text",
					],
				},
			});
			expect(Object.keys(await models(false))).toEqual([
				"plain",
			]);
			expect(await chatModelCheck()).toMatchObject({
				status: "failing",
				reason: "CHAT_MODEL_CAPABILITIES_UNKNOWN",
				params: {
					count: 1,
				},
			});

			const { plain, "text-only": textOnly } = await models();
			await run(
				procedures.model.update(
					{
						id: plain.id,
						capabilities: [
							"text",
							"tool-calling",
						],
					},
					options,
				),
			);
			expect(await chatModelCheck()).toMatchObject({
				status: "ok",
				reason: "CHAT_MODEL_READY",
			});

			// The provider now reports both; the admin's set stays, the reported one too.
			listing = [
				openRouterModel("plain", []),
				openRouterModel("text-only", [
					"tools",
				]),
			];
			expect(await discover()).toEqual({
				foundCount: 2,
				addedCount: 0,
				alreadyExistedCount: 2,
				capabilitiesUnsetCount: 0,
			});
			expect(await models()).toMatchObject({
				plain: {
					id: plain.id,
					capabilities: [
						"text",
						"tool-calling",
					],
				},
				"text-only": {
					id: textOnly.id,
					capabilities: [
						"text",
					],
				},
			});

			// Clearing means unknown, so the next discovery fills in what the provider reports.
			await run(
				procedures.model.update(
					{
						id: textOnly.id,
						capabilities: [],
					},
					options,
				),
			);
			await discover();
			expect(await models()).toMatchObject({
				plain: {
					capabilities: [
						"text",
						"tool-calling",
					],
				},
				"text-only": {
					capabilities: [
						"text",
						"tool-calling",
					],
				},
			});
		},
		TIMEOUT,
	);

	test(
		"an admin who chooses no capabilities leaves them unset",
		async () => {
			const {
				actors: [admin],
				zedToken,
			} = await organizationWith([
				"admin",
			]);
			const procedures = await run(Procedures);
			const options = await procedureOptions(admin, zedToken);
			const { data: provider } = await run(
				procedures.provider.create(
					{
						name: `Manual ${crypto.randomUUID()}`,
						description: "Created by the discovery test.",
						kind: "openai-compatible",
						endpoint: `${server.url.origin}/v1`,
						apiKey: "key",
						meteringMode: "tokens",
						enabled: true,
					},
					options,
				),
			);
			const { data: model } = await run(
				procedures.model.create(
					{
						providerId: provider.id,
						providerModelId: crypto.randomUUID(),
						name: "Manual model",
						description: "",
						isDeprecated: false,
						capabilities: [],
					},
					options,
				),
			);
			expect(model.capabilities).toBeNull();
		},
		TIMEOUT,
	);
});
