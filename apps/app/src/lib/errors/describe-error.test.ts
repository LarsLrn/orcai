import { describe, expect, spyOn, test } from "bun:test";
import { ORPCError } from "@orpc/client";
import { m } from "@/paraglide/messages";
import {
	describeError,
	errorReasonOf,
	reasonMessageOf,
} from "./describe-error";
import { ReasonError } from "./reason-error";

describe("errorReasonOf", () => {
	test("reads an oRPC error's reason and params", () => {
		const error = new ORPCError("BAD_REQUEST", {
			data: {
				reason: "BOT_REPOSITORY_EMPTY",
				params: {
					blockName: "Docs",
				},
			},
		});

		expect(errorReasonOf(error)).toEqual({
			reason: "BOT_REPOSITORY_EMPTY",
			params: {
				blockName: "Docs",
			},
		});
	});

	test("maps a not found entity to its reason", () => {
		const error = new ORPCError("NOT_FOUND", {
			data: {
				entity: "bot",
			},
		});

		expect(errorReasonOf(error)?.reason).toBe("BOT_NOT_FOUND");
	});

	test("accepts a bare reason as a message", () => {
		expect(errorReasonOf(new Error("AI_STREAM_FAILED"))?.reason).toBe(
			"AI_STREAM_FAILED",
		);
		expect(errorReasonOf("CHAT_NOT_FOUND")?.reason).toBe("CHAT_NOT_FOUND");
		expect(errorReasonOf(new Error("Some English"))).toBeUndefined();
	});
});

describe("describeError", () => {
	test("translates a reason with its params", () => {
		expect(
			describeError(
				new ORPCError("BAD_REQUEST", {
					data: {
						reason: "BOT_REPOSITORY_EMPTY",
						params: {
							blockName: "Docs",
						},
					},
				}),
			),
		).toBe(
			m.error_bot_repository_empty({
				blockName: "Docs",
			}),
		);
		expect(describeError(new ReasonError("SYSTEM_GROUP_IMMUTABLE"))).toBe(
			m.error_system_group_immutable(),
		);
	});

	test("falls back to the transport code without a reason", () => {
		expect(
			describeError(
				new ORPCError("FORBIDDEN", {
					message: "Server English",
				}),
			),
		).toBe(m.error_generic_forbidden());
		expect(describeError(new ORPCError("INPUT_VALIDATION_FAILED", {}))).toBe(
			m.error_generic_validation(),
		);
		expect(describeError(new Error("Server English"))).toBe(
			m.error_generic_unknown(),
		);
	});

	test("never surfaces an unknown reason string", () => {
		const consoleError = spyOn(console, "error").mockImplementation(
			() => undefined,
		);
		const error = new ORPCError("BAD_REQUEST", {
			data: {
				reason: "NOT_A_REASON",
			},
		});

		expect(reasonMessageOf(error)).toBeUndefined();
		expect(describeError(error)).toBe(m.error_generic_bad_request());
		expect(consoleError).toHaveBeenCalledTimes(2);
		consoleError.mockRestore();
	});
});
