import type { AssetId } from "@orcai/core";
import type { Asset, KeptUploads } from "@orcai/schema";
import { useRef, useState } from "react";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";
import type { RequestUploadOutput } from "@/lib/ai/tools/assistant/bots/request-upload";

/** Why Continue did not answer: the list is not stored, or none of its files are left. */
export type UploadProblem = "unsaved" | "gone";

/**
 * Answers one `requestUpload` call. Each change to the list is stored with
 * the reply, so a reload restores it. Continue stores the list once more and
 * answers `saved` with the files the user can still use; Cancel answers
 * `cancelled` and leaves uploaded files in the Library. Cancel asks first
 * while an upload is in flight, and the caller aborts it by unmounting. Only
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
	const [problem, setProblem] = useState<UploadProblem>();
	const answered = useRef(false);
	const [initial] = useState<KeptUploads>(
		() =>
			answers?.uploads(toolCallId) ?? {
				assets: [],
			},
	);
	// Refs, so changes in quick succession build on each other.
	const assetIds = useRef<AssetId[]>(initial.assets.map(({ id }) => id));
	const zedToken = useRef(initial.zedToken);
	const lastSave = useRef(0);

	/** Stores the list; only the newest save decides whether it is unsaved. */
	const save = async () => {
		if (!answers) return undefined;
		const current = ++lastSave.current;
		try {
			const kept = await answers.keepUploads({
				toolCallId,
				assetIds: assetIds.current,
				zedToken: zedToken.current,
			});
			if (current === lastSave.current) setProblem(undefined);
			return kept;
		} catch {
			if (current === lastSave.current) setProblem("unsaved");
			return undefined;
		}
	};

	const change = (update: (current: AssetId[]) => AssetId[]) => {
		if (answered.current) return;
		assetIds.current = update(assetIds.current);
		void save();
	};

	const answer = (output: RequestUploadOutput) => {
		if (!answers || answered.current) return;
		answered.current = true;
		answers.output({
			tool: "requestUpload",
			toolCallId,
			output,
			zedToken: zedToken.current,
		});
	};

	return {
		/** The files listed when the widget mounted, as after a reload. */
		initialAssetIds: initial.assets.map(({ id }) => id),
		problem,
		setIsUploading,
		created: (assets: Pick<Asset, "id">[], token: string | undefined) => {
			zedToken.current = token ?? zedToken.current;
			change((current) => [
				...current,
				...assets.map(({ id }) => id).filter((id) => !current.includes(id)),
			]);
		},
		removed: (assetId: AssetId) =>
			change((current) => current.filter((id) => id !== assetId)),
		retry: () => void save(),
		continue: async () => {
			if (answered.current || isUploading || assetIds.current.length === 0) {
				return;
			}
			const sent = assetIds.current;
			const kept = await save();
			// A change while saving gets its own save, so this answer would be stale.
			if (!kept || assetIds.current !== sent) return;
			assetIds.current = kept.assets.map(({ id }) => id);
			if (kept.assets.length === 0) {
				setProblem("gone");
				return;
			}
			answer({
				status: "saved",
				assets: kept.assets,
			});
		},
		cancel: async () => {
			if (isUploading && !(await confirmDiscard())) return;
			answer({
				status: "cancelled",
			});
		},
	};
};
