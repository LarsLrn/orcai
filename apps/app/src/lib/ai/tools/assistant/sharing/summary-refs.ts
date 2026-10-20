import { m } from "@/paraglide/messages";
import type { NameRef } from "../summary";

export const resourceRef = (input: {
	resourceType: "bot" | "block" | "asset";
	resourceId: string;
}): NameRef => ({
	kind: input.resourceType,
	id: input.resourceId,
});

export const principalRef = (principal: {
	principalType: "user" | "group";
	principalId: string;
}): NameRef => ({
	kind: principal.principalType,
	id: principal.principalId,
});

export const quoted = (name: string) =>
	m.assistant_tool_quoted_name({
		name,
	});
