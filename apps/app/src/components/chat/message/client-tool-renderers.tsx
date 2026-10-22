import { UploadWidget } from "@/components/assistant/upload-widget";
import { RequestUpload } from "@/components/chat/message/work-log/tools/request-upload";
import { SummaryEntry } from "@/components/chat/message/work-log/tools/summary-entry";
import { QuestionsWidget } from "@/components/chat/questions/questions-widget";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";
import type { ClientToolPart, ToolStatus } from "@/lib/ai/turn-view/turn-view";

/** A client call in the answer; `answers` only while it can be answered. */
export const ClientToolWidget = ({
	part,
	status,
	answers,
}: {
	part: ClientToolPart;
	status: ToolStatus | null;
	answers: StepAnswers | undefined;
}) => {
	switch (part.type) {
		case "tool-requestUpload":
			return <UploadWidget part={part} status={status} answers={answers} />;
		case "tool-askUser":
			return <QuestionsWidget part={part} status={status} answers={answers} />;
	}
};

/** A client call in the work log. */
export const ClientToolEntry = ({
	part,
	status,
}: {
	part: ClientToolPart;
	status: ToolStatus | null;
}) => {
	switch (part.type) {
		case "tool-requestUpload":
			return <RequestUpload part={part} status={status} />;
		case "tool-askUser":
			return <SummaryEntry part={part} status={status} />;
	}
};
