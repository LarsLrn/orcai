import { ClientToolEntry } from "@/components/chat/message/client-tool-renderers";
import { isToolOfKind } from "@/lib/ai/tools/registry";
import type { ToolPart, ToolStatus } from "@/lib/ai/turn-view/turn-view";
import { GetAssetPage } from "./tools/get-asset-page";
import { GetPassages } from "./tools/get-passages";
import { ListRepositoryAssets } from "./tools/list-repository-assets";
import { NativeWebSearch } from "./tools/native-web-search";
import { ReadDocs } from "./tools/read-docs";
import { SearchRepositories } from "./tools/search-repositories";
import { SearchWeb } from "./tools/search-web";
import { SummaryEntry } from "./tools/summary-entry";

export interface ToolEntryPartProps {
	part: ToolPart;
	status: ToolStatus | null;
}

/** Routes a tool part to its renderer; any other reads as its summary line. */
export const ToolEntryPart = ({ part, status }: ToolEntryPartProps) => {
	if (isToolOfKind(part, "client")) {
		return <ClientToolEntry part={part} status={status} />;
	}

	switch (part.type) {
		case "tool-searchRepositories":
			return <SearchRepositories part={part} status={status} />;
		case "tool-getPassages":
			return <GetPassages part={part} status={status} />;
		case "tool-getAssetPage":
			return <GetAssetPage part={part} status={status} />;
		case "tool-listRepositoryAssets":
			return <ListRepositoryAssets part={part} status={status} />;
		case "tool-readDocs":
			return <ReadDocs part={part} status={status} />;
		case "tool-searchWeb":
			return <SearchWeb part={part} status={status} />;
		case "tool-web_search":
			return <NativeWebSearch part={part} status={status} />;
		default:
			return <SummaryEntry part={part} status={status} />;
	}
};
