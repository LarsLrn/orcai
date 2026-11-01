import type { RepositoryReadiness } from "@orcai/schema";

export type AssetsPanelView = {
	/** Preparing while any asset is; otherwise only failures are left. */
	status: "preparing" | "failed";
	ready: number;
	total: number;
	failed: number;
};

/** What the panel shows, or nothing once every asset is ready. */
export const assetsPanelView = (
	repositories: readonly Pick<RepositoryReadiness, "totals">[],
): AssetsPanelView | undefined => {
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
