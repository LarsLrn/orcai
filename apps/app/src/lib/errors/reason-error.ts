import type { ErrorReason } from "@orcai/schema";

/** A client-raised failure carrying a reason, for channels that are not oRPC. */
export class ReasonError extends Error {
	readonly reason: ErrorReason;
	readonly params: unknown;

	constructor(reason: ErrorReason, params?: unknown) {
		super(reason);
		this.name = "ReasonError";
		this.reason = reason;
		this.params = params;
	}
}
