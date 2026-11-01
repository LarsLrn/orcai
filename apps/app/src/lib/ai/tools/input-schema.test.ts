import { describe, expect, test } from "bun:test";
import { assetIdSchema } from "@orcai/schema";
import { asSchema } from "ai";
import { z } from "zod/v4";
import { buildGenUiTools } from "@/components/chat/gen-ui/catalog";
import { toolInputSchema } from "./input-schema";

const ASSET_ID = "9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f";

const inputSchema = z.strictObject({
	ids: z.array(assetIdSchema).describe("Assets to read."),
	note: z.string().optional(),
});

describe("toolInputSchema", () => {
	test("sends no $schema and no UUID pattern, but keeps the format", async () => {
		const json = await asSchema(toolInputSchema(inputSchema)).jsonSchema;

		expect(json).toEqual({
			type: "object",
			properties: {
				ids: {
					type: "array",
					items: {
						type: "string",
						format: "uuid",
					},
					description: "Assets to read.",
				},
				note: {
					type: "string",
				},
			},
			required: [
				"ids",
			],
			additionalProperties: false,
		});
	});

	test("still rejects an id that is not a UUID", async () => {
		const { validate } = asSchema(toolInputSchema(inputSchema));

		expect(
			await validate?.({
				ids: [
					ASSET_ID,
				],
			}),
		).toMatchObject({
			success: true,
		});
		expect(
			await validate?.({
				ids: [
					"not-an-id",
				],
			}),
		).toMatchObject({
			success: false,
		});
	});

	test("slims the display tools too", async () => {
		const json = JSON.stringify(
			await asSchema(
				buildGenUiTools({
					citations: true,
				}).showChecklist.inputSchema,
			).jsonSchema,
		);

		expect(json).not.toContain("$schema");
		expect(json).not.toContain('"pattern"');
	});
});
