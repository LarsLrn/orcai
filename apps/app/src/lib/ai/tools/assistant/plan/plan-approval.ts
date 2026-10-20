const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

/** Whether the user approved a plan of the conversation, which unlocks the create tools. */
export const isPlanApproved = (
	messages: readonly {
		role: string;
		parts: readonly unknown[];
	}[],
): boolean =>
	messages.some(
		(message) =>
			message.role === "assistant" &&
			message.parts.some(
				(part) =>
					isRecord(part) &&
					part.type === "tool-updatePlan" &&
					part.state === "output-available" &&
					isRecord(part.approval) &&
					part.approval.approved === true,
			),
	);
