import { useMatches, useRouterState } from "@tanstack/react-router";
import { findBlockSection } from "@/lib/navigation/block-section";

/** The current pathname, with a block page standing in for its library tab. */
export const useSectionPathname = () => {
	const matches = useMatches();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return findBlockSection(matches)?.to ?? pathname;
};
