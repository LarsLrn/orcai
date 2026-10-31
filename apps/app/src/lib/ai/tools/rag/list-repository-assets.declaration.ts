import { LibraryIcon } from "lucide-react";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { listRepositoryAssetsTool } from "./list-repository-assets";

export const listRepositoryAssets = declareTool<
	typeof listRepositoryAssetsTool
>()({
	kind: "read",
	icon: LibraryIcon,
	name: m.chat_work_log_tool_list_documents_name,
	active: m.chat_work_log_tool_list_documents_active,
});
