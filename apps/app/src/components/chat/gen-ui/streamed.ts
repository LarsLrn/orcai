import { type Status, statusSchema } from "@/components/chat/gen-ui/status";

// Streamed input is unvalidated, so every field may be missing or malformed.

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === "object" && !Array.isArray(value);

export const textOf = (value: unknown): string | undefined =>
	typeof value === "string" && value !== "" ? value : undefined;

/** A status cut off mid-stream is not one yet. */
export const statusOf = (value: unknown): Status | undefined => {
	const parsed = statusSchema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
};

export const listOf = (value: unknown): unknown[] =>
	Array.isArray(value) ? value : [];
