import type { Asset } from "@orcai/schema";
import { useRef, useState } from "react";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";
import type { RequestUploadOutput } from "@/lib/ai/tools/assistant/bots/request-upload";

/**
 * Answers one `requestUpload` call: `saved` as soon as assets exist, so no
 * further click is needed. Cancel answers at once before an upload; while one
 * is in flight it asks first, and the caller aborts it by unmounting. Only
 * the first answer counts.
 */
export const useUploadAnswer = ({
	toolCallId,
	answers,
	confirmDiscard,
}: {
	toolCallId: string;
	answers: StepAnswers | undefined;
	confirmDiscard: () => Promise<boolean>;
}) => {
	const [isUploading, setIsUploading] = useState(false);
	const answered = useRef(false);

	const answer = (output: RequestUploadOutput, zedToken?: string) => {
		if (!answers || answered.current) return;
		answered.current = true;
		answers.output({
			tool: "requestUpload",
			toolCallId,
			output,
			zedToken,
		});
	};

	return {
		setIsUploading,
		created: (
			assets: Pick<Asset, "id" | "title">[],
			zedToken: string | undefined,
		) =>
			answer(
				{
					status: "saved",
					assets: assets.map(({ id, title }) => ({
						id,
						title,
					})),
				},
				zedToken,
			),
		cancel: async () => {
			if (isUploading && !(await confirmDiscard())) return;
			answer({
				status: "cancelled",
			});
		},
	};
};
