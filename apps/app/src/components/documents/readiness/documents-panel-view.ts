import type { RepositoryReadiness } from "@orcai/schema";

export type DocumentsPanelView = {
	/** Preparing while any document is; otherwise only failures are left. */
	status: "preparing" | "failed";
	ready: number;
	total: number;
	failed: number;
};

/** What the panel shows, or nothing once every document is ready. */
export const documentsPanelView = (
	repositories: readonly Pick<RepositoryReadiness, "totals">[],
): DocumentsPanelView | undefined => {
	const sum = (key: keyof RepositoryReadiness["totals"]) =>
		repositories.reduce((total, { totals }) => total + totals[key], 0);
	const preparing = sum("preparing");
	const failed = sum("failed");

	if (preparing === 0 && failed === 0) return undefined;

	return {
		status: preparing > 0 ? "preparing" : "failed",
		ready: sum("ready"),
		total: sum("total"),
		failed,
	};
};
