import type { EntityRef } from "@/lib/ai/tools/entity-kind";
import { m } from "@/paraglide/messages";

export const targetRef = (input: {
	targetType: "bot" | "block" | "asset";
	targetId: string;
}): EntityRef => ({
	kind: input.targetType,
	id: input.targetId,
});

export const granteeRef = (grantee: {
	granteeType: "user" | "group";
	granteeId: string;
}): EntityRef => ({
	kind: grantee.granteeType === "user" ? "member" : "group",
	id: grantee.granteeId,
});

export const quoted = (name: string) =>
	m.assistant_tool_quoted_name({
		name,
	});
