import { resourceGrantRoleSchema } from "@orcai/schema";
import { ShieldPlusIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { getResourceRoleLabel } from "@/settings/display-config";
import type { grantAccessTool } from "./grant-access";
import { granteeShape, targetShape } from "./resource-target-input";
import { granteeRef, quoted, targetRef } from "./summary-refs";

export const grantAccessInputSchema = z.strictObject({
	...targetShape,
	grantees: z
		.array(z.strictObject(granteeShape))
		.min(1)
		.max(50)
		.describe("The users and groups that get the role."),
	role: resourceGrantRoleSchema.describe(
		"viewer: Can view, to read and use it. editor: Can edit, also to edit it. manager: Can manage, also to manage its access.",
	),
});

export const grantAccess = declareTool<typeof grantAccessTool>()({
	kind: "change",
	group: "sharing",
	capabilities: [
		"create_bot",
	],
	confirm: "grant",
	inputSchema: grantAccessInputSchema,
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
