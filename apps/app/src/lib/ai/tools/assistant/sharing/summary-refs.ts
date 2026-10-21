import type { EntityRef } from "@/lib/ai/tools/entity-kind";
import { m } from "@/paraglide/messages";

export const resourceRef = (input: {
	resourceType: "bot" | "block" | "asset";
	resourceId: string;
}): EntityRef => ({
	kind: input.resourceType,
	id: input.resourceId,
});

export const principalRef = (principal: {
	principalType: "user" | "group";
	principalId: string;
}): EntityRef => ({
	kind: principal.principalType === "user" ? "member" : "group",
	id: principal.principalId,
});

export const quoted = (name: string) =>
	m.assistant_tool_quoted_name({
		name,
	});
