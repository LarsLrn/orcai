import { ShieldPlusIcon } from "lucide-react";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { getResourceRoleLabel } from "@/settings/display-config";
import type { grantAccessTool } from "./grant-access";
import { granteeRef, quoted, targetRef } from "./summary-refs";

export const grantAccess = declareTool<typeof grantAccessTool>()({
	kind: "change",
	group: "sharing",
	capabilities: [
		"create_bot",
	],
	confirm: "grant",
	icon: ShieldPlusIcon,
	name: () => m.assistant_tool_grant_access_name(),
	active: () => m.assistant_tool_grant_access_active(),
	refs: ({ input, output }) =>
		input
			? [
					targetRef(input),
					...(output ? [] : input.grantees.map(granteeRef)),
				]
			: [],
	line: ({ input, output }, nameOf) => {
		if (!input) {
			return m.assistant_tool_grant_access_name();
		}

		const names = output
			? output.granted.map((grant) => grant.name)
			: input.grantees.map((grantee) => nameOf(granteeRef(grantee)));

		return m.assistant_tool_grant_access_summary({
			names: formatNames(names),
			role: getResourceRoleLabel(input.role),
			resource: quoted(nameOf(targetRef(input))),
		});
	},
});
