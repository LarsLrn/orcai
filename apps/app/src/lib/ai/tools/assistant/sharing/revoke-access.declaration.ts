import { ShieldMinusIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { revokeAccessTool } from "./revoke-access";
import { principalRef, quoted, resourceRef } from "./summary-refs";

export const revokeAccess = declareTool<typeof revokeAccessTool>()({
	kind: "change",
	group: "sharing",
	capabilities: [
		"create_bot",
	],
	confirm: "remove",
	icon: ShieldMinusIcon,
	name: () => m.assistant_tool_revoke_access_name(),
	active: () => m.assistant_tool_revoke_access_active(),
	refs: ({ input }) =>
		input
			? [
					resourceRef(input),
					principalRef(input),
				]
			: [],
	line: ({ input }, nameOf) =>
		input
			? m.assistant_tool_revoke_access_summary({
					resource: quoted(nameOf(resourceRef(input))),
					name: quoted(nameOf(principalRef(input))),
				})
			: m.assistant_tool_revoke_access_name(),
});
