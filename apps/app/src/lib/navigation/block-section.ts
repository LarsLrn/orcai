import { type BlockType, blockTypeSchema } from "@orcai/schema";
import type { AnyRouteMatch } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";

/** The library tab that lists blocks of a type. */
export const blockSection = (type: BlockType) =>
	type === "database"
		? {
				to: "/app/hub/repositories" as const,
				label: m.hub_tab_repositories_label,
			}
		: {
				to: "/app/hub/behaviour" as const,
				label: m.hub_tab_behaviour_label,
			};

/**
 * The library tab of the block page among `matches`. Block pages live under
 * `/app/hub/blocks`, which is not a tab, so their place is read from the
 * block's type.
 */
export const findBlockSection = (matches: readonly AnyRouteMatch[]) => {
	for (const match of matches) {
		const type = blockTypeSchema.safeParse(
			match.routeId === "/app/hub/blocks/$blockId"
				? match.loaderData?.data.type
				: match.routeId === "/app/hub/blocks/add"
					? match.search.type
					: undefined,
		);

		if (type.success) {
			return blockSection(type.data);
		}
	}

	return undefined;
};
