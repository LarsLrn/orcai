import { describe, expect, test } from "bun:test";
import { estimateQuotaReservationAmount } from "../src/estimator";

describe("estimateQuotaReservationAmount", () => {
	describe("requests metering", () => {
		test("uses the explicit maximum provider requests when provided", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "requests",
				isFirstTurn: true,
				maxExpectedProviderRequests: 5,
				messages: [],
			});

			expect(result).toBe(5);
		});

		test("falls back to agent steps plus one on the first turn", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "requests",
				isFirstTurn: true,
				messages: [],
			});

			expect(result).toBe(11);
		});

		test("falls back to agent steps on subsequent turns", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "requests",
				isFirstTurn: false,
				messages: [],
			});

			expect(result).toBe(10);
		});
	});

	describe("tokens metering", () => {
		test("uses the default output cap when the prompt estimate is tiny", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				isFirstTurn: true,
				messages: [],
			});

			expect(result).toBe(16_385);
		});

		test("adds the default output token cap to the prompt estimate", () => {
			const messages = [
				{
					role: "user",
					content: "hello",
				},
			];
			const promptEstimate = Math.ceil(JSON.stringify(messages).length / 4);

			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				isFirstTurn: true,
				messages,
			});

			expect(result).toBe(Math.max(512, promptEstimate + 16_384));
		});

		test("uses the provided maximum output tokens", () => {
			const messages = [
				{
					role: "user",
					content: "hi",
				},
			];
			const promptEstimate = Math.ceil(JSON.stringify(messages).length / 4);

			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				isFirstTurn: false,
				maxExpectedOutputTokens: 256,
				messages,
			});

			expect(result).toBe(Math.max(512, promptEstimate + 256));
		});

		test("respects the minimum token reservation", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				isFirstTurn: false,
				maxExpectedOutputTokens: 1,
				messages: [
					{
						role: "user",
						content: "x",
					},
				],
			});

			expect(result).toBe(512);
		});
	});
});
