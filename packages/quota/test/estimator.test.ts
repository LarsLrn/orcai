import { describe, expect, test } from "bun:test";
import { estimateQuotaReservationAmount } from "../src/estimator";

describe("estimateQuotaReservationAmount", () => {
	describe("requests metering", () => {
		test("reserves the maximum provider requests of the call", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "requests",
				maxExpectedProviderRequests: 25,
				messages: [
					{
						role: "user",
						content: "hello",
					},
				],
			});

			expect(result).toBe(25);
		});
	});

	describe("tokens metering", () => {
		test("uses the default output cap when the prompt estimate is tiny", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				maxExpectedProviderRequests: 25,
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
				maxExpectedProviderRequests: 25,
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
				maxExpectedProviderRequests: 25,
				maxExpectedOutputTokens: 256,
				messages,
			});

			expect(result).toBe(Math.max(512, promptEstimate + 256));
		});

		test("a smaller model max output lowers the default output cap", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				maxExpectedProviderRequests: 25,
				modelMaxOutputTokens: 4_096,
				messages: [],
			});

			expect(result).toBe(4_097);
		});

		test("a larger model max output keeps the default output cap", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				maxExpectedProviderRequests: 25,
				modelMaxOutputTokens: 128_000,
				messages: [],
			});

			expect(result).toBe(16_385);
		});

		test("prefers the call's cap over the model's max output", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				maxExpectedProviderRequests: 25,
				maxExpectedOutputTokens: 1_000,
				modelMaxOutputTokens: 128_000,
				messages: [],
			});

			expect(result).toBe(1_001);
		});

		test("uses the default output cap when the model's max output is unknown", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				maxExpectedProviderRequests: 25,
				modelMaxOutputTokens: null,
				messages: [],
			});

			expect(result).toBe(16_385);
		});

		test("respects the minimum token reservation", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				maxExpectedProviderRequests: 25,
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
