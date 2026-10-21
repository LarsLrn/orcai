import type { Asset } from "@orcai/schema";
import { useRef, useState } from "react";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";
import type { RequestUploadOutput } from "@/lib/ai/tools/assistant/bots/request-upload";

/**
 * Answers one `requestUpload` call. Cancel waits while a save runs and asks
 * first when uploads are unsaved; a save that lands while that prompt is
 * open wins, since only the first answer counts.
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
	const [hasPendingUploads, setHasPendingUploads] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
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
		isSaving,
		setIsSaving,
		setHasPendingUploads,
		save: (
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
			if (isSaving) return;
			if (hasPendingUploads && !(await confirmDiscard())) return;
			answer({
				status: "cancelled",
			});
		},
	};
};
