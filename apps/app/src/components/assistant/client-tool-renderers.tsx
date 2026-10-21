import type { ReactNode } from "react";
import { RequestUpload } from "@/components/chat/message/work-log/tools/assistant-tool";
import type { AssistantToolPart } from "@/lib/ai/tools/assistant/summary";
import type {
	ClientToolName,
	ClientToolPart,
	ToolStatus,
} from "@/lib/ai/turn-view/turn-view";
import type { ClientToolActions } from "./client-tool-actions";
import { UploadWidget } from "./upload-widget";

interface ClientToolRenderers<Name extends ClientToolName> {
	/** The call in a paused step's answer; `actions` only while it can be answered. */
	Widget: (props: {
		part: AssistantToolPart<Name>;
		status: ToolStatus | null;
		actions: ClientToolActions | undefined;
	}) => ReactNode;
	/** The call in the work log. */
	Entry: (props: {
		part: AssistantToolPart<Name>;
		status: ToolStatus | null;
	}) => ReactNode;
}

const clientToolRenderers: {
	[Name in ClientToolName as `tool-${Name}`]: ClientToolRenderers<Name>;
} = {
	"tool-requestUpload": {
		Widget: UploadWidget,
		Entry: RequestUpload,
	},
};

export const clientToolRenderersOf = (
	part: ClientToolPart,
): ClientToolRenderers<ClientToolName> => clientToolRenderers[part.type];
