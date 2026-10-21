import type { BlockId } from "@orcai/core";
import { DocumentsPanelCard } from "./documents-panel-card";
import { useRepositoryReadiness } from "./use-repository-readiness";

/** The documents panel for the repositories a chat turn searches. */
export const DocumentsPanel = ({ blockIds }: { blockIds: BlockId[] }) => {
	const { data } = useRepositoryReadiness(blockIds);

	return <DocumentsPanelCard repositories={data?.data ?? []} />;
};
