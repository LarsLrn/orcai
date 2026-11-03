import { describe, expect, test } from "bun:test";
import { charTokens, promptTokens, reservationAmount } from "../src/estimator";

describe("promptTokens", () => {
	test("counts text at four characters per token", () => {
		expect(
			promptTokens([
				"a".repeat(38),
			]),
		).toBe(10);
	});

	test("counts a UI message by its parts and a file as a large image", () => {
		const text = {
			type: "text",
			text: "hello",
		};

		expect(
			promptTokens([
				{
					id: "m1",
					role: "user",
					parts: [
						text,
						{
							type: "file",
							mediaType: "image/png",
							url: `data:image/png;base64,${"A".repeat(100_000)}`,
						},
					],
				},
			]),
		).toBe(charTokens(text) + 1_600);
	});

	test("counts a model message by its content, images and files alike", () => {
		expect(
			promptTokens([
				{
					role: "system",
					content: "Be brief.",
				},
				{
					role: "user",
					content: [
						{
							type: "image",
							image: "A".repeat(100_000),
						},
						{
							type: "file",
							data: "A".repeat(100_000),
							mediaType: "application/pdf",
						},
					],
				},
			]),
		).toBe(charTokens("Be brief.") + 3_200);
	});
});

describe("reservationAmount", () => {
	test("reserves the call's requests with requests metering", () => {
		expect(
			reservationAmount({
				meteringMode: "requests",
				maxRequests: 25,
				inputTokens: 10_000,
				maxOutputTokens: 2_000,
			}),
		).toBe(25);
	});

	test("reserves the input and the output cap with tokens metering", () => {
		expect(
			reservationAmount({
				meteringMode: "tokens",
				maxRequests: 25,
				inputTokens: 10_000,
				maxOutputTokens: 2_000,
			}),
		).toBe(12_000);
	});

	test("reserves 4,096 output tokens without a cap", () => {
		expect(
			reservationAmount({
				meteringMode: "tokens",
				maxRequests: 1,
				inputTokens: 1_000,
				maxOutputTokens: undefined,
			}),
		).toBe(5_096);
	});

	test("reserves at least 512 tokens", () => {
		expect(
			reservationAmount({
				meteringMode: "tokens",
				maxRequests: 1,
				inputTokens: 10,
				maxOutputTokens: 100,
			}),
		).toBe(512);
	});
});
