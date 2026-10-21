import { describe, expect, test } from "bun:test";
import {
	estimateQuotaReservationAmount,
	reservedOutputTokens,
} from "../src/estimator";

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

		test("a call without its own cap reserves the default output", () => {
			const result = estimateQuotaReservationAmount({
				meteringMode: "tokens",
				maxExpectedProviderRequests: 25,
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

describe("reservedOutputTokens", () => {
	test("a smaller model max output lowers the default", () => {
		expect(
			reservedOutputTokens({
				modelMaxOutputTokens: 4_096,
			}),
		).toBe(4_096);
	});

	test("a larger or unknown model max output keeps the default", () => {
		expect(
			reservedOutputTokens({
				modelMaxOutputTokens: 128_000,
			}),
		).toBe(16_384);
		expect(
			reservedOutputTokens({
				modelMaxOutputTokens: null,
			}),
		).toBe(16_384);
	});

	test("prefers the call's cap over the model's max output", () => {
		expect(
			reservedOutputTokens({
				maxExpectedOutputTokens: 1_000,
				modelMaxOutputTokens: 128_000,
			}),
		).toBe(1_000);
	});
});
