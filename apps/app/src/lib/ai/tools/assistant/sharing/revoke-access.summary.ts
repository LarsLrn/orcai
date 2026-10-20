import { ShieldMinusIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { defineToolSummary } from "../summary";
import { principalRef, quoted, resourceRef } from "./summary-refs";

export const revokeAccessSummary = defineToolSummary<"revokeAccess">({
	icon: ShieldMinusIcon,
	name: () => m.assistant_tool_revoke_access_name(),
	active: () => m.assistant_tool_revoke_access_active(),
	refs: (part) =>
		part.input
			? [
					resourceRef(part.input),
					principalRef(part.input),
				]
			: [],
	line: (part, nameOf) =>
		part.input
			? m.assistant_tool_revoke_access_summary({
					resource: quoted(nameOf(resourceRef(part.input))),
					name: quoted(nameOf(principalRef(part.input))),
				})
			: m.assistant_tool_revoke_access_name(),
	verb: "remove",
});
