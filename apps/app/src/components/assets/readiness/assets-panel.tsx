import type { BlockId } from "@orcai/core";
import { AssetsPanelCard } from "./assets-panel-card";
import { useRepositoryReadiness } from "./use-repository-readiness";

/** The assets panel for the repositories a chat turn searches. */
export const AssetsPanel = ({ blockIds }: { blockIds: BlockId[] }) => {
	const { data } = useRepositoryReadiness(blockIds);

	return <AssetsPanelCard repositories={data?.data ?? []} />;
};
