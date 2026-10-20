import type { Asset } from "@orcai/schema";
import { useRef, useState } from "react";
import type { ClientToolActions } from "@/components/chat/continue-turn";
import type { RequestUploadOutput } from "@/lib/ai/tools/assistant/bots/request-upload";

/**
 * Answers one `requestUpload` call. Cancel waits while a save runs and asks
 * first when uploads are unsaved; a save that lands while that prompt is
 * open wins, since only the first answer counts.
 */
export const useUploadAnswer = ({
	toolCallId,
	actions,
	confirmDiscard,
}: {
	toolCallId: string;
	actions: ClientToolActions | undefined;
	confirmDiscard: () => Promise<boolean>;
}) => {
	const [hasPendingUploads, setHasPendingUploads] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const answered = useRef(false);

	const answer = (output: RequestUploadOutput, zedToken?: string) => {
		if (!actions || answered.current) return;
		answered.current = true;
		actions.keepZedToken(zedToken);
		void actions.addToolOutput({
			tool: "requestUpload",
			toolCallId,
			output,
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
