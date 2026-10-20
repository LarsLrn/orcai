import { ShieldPlusIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { getResourceRoleLabel } from "@/settings/display-config";
import { defineToolSummary, formatNames } from "../summary";
import { principalRef, quoted, resourceRef } from "./summary-refs";

export const grantAccessSummary = defineToolSummary<"grantAccess">({
	icon: ShieldPlusIcon,
	name: () => m.assistant_tool_grant_access_name(),
	active: () => m.assistant_tool_grant_access_active(),
	refs: (part) =>
		part.input
			? [
					resourceRef(part.input),
					...(part.state === "output-available"
						? []
						: part.input.principals.map(principalRef)),
				]
			: [],
	line: (part, nameOf) => {
		if (!part.input) {
			return m.assistant_tool_grant_access_name();
		}

		const names =
			part.state === "output-available"
				? part.output.granted.map((grant) => grant.name)
				: part.input.principals.map((principal) =>
						nameOf(principalRef(principal)),
					);

		return m.assistant_tool_grant_access_summary({
			names: formatNames(names),
			role: getResourceRoleLabel(part.input.role),
			resource: quoted(nameOf(resourceRef(part.input))),
		});
	},
	verb: "grant",
});
