import { ShieldMinusIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { granteeShape, targetShape } from "./resource-target-input";
import type { revokeAccessTool } from "./revoke-access";
import { granteeRef, quoted, targetRef } from "./summary-refs";

export const revokeAccessInputSchema = z.strictObject({
	...targetShape,
	...granteeShape,
});

export const revokeAccess = declareTool<typeof revokeAccessTool>()({
	kind: "change",
	group: "sharing",
	capabilities: [
		"create_bot",
	],
	confirm: "remove",
	inputSchema: revokeAccessInputSchema,
	icon: ShieldMinusIcon,
	name: () => m.assistant_tool_revoke_access_name(),
	active: () => m.assistant_tool_revoke_access_active(),
	refs: ({ input }) =>
		input
			? [
					targetRef(input),
					granteeRef(input),
				]
			: [],
	line: ({ input }, nameOf) =>
		input
			? m.assistant_tool_revoke_access_summary({
					resource: quoted(nameOf(targetRef(input))),
					name: quoted(nameOf(granteeRef(input))),
				})
			: m.assistant_tool_revoke_access_name(),
});
