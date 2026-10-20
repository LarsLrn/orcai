import { useEffect, useRef, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
	isLiveReasoning,
	type ReasoningPart,
} from "@/components/chat/message/classify-turn";
import { m } from "@/paraglide/messages";
import { ClampedText } from "./clamped-text";

const MS_IN_S = 1000;

/** Seconds spent streaming; undefined for parts that were already complete. */
const useStreamDuration = (streaming: boolean) => {
	const startedAt = useRef<number | null>(null);
	const [duration, setDuration] = useState<number>();

	useEffect(() => {
		if (streaming) {
			startedAt.current ??= Date.now();
		} else if (startedAt.current !== null) {
			setDuration(Math.ceil((Date.now() - startedAt.current) / MS_IN_S));
			startedAt.current = null;
		}
	}, [
		streaming,
	]);

	return duration;
};

export const ReasoningEntry = ({
	part,
	running,
}: {
	part: ReasoningPart;
	running: boolean;
}) => {
	const streaming = isLiveReasoning(part, running);
	const duration = useStreamDuration(streaming);

	return (
		<div className="min-w-0">
			<p className="font-medium text-sm">
				{streaming ? (
					<Shimmer as="span" duration={1}>
						{m.chat_work_log_thinking()}
					</Shimmer>
				) : duration === undefined ? (
					m.chat_work_log_reasoning_duration_unknown()
				) : (
					m.chat_work_log_reasoning_duration({
						count: duration,
					})
				)}
			</p>
			{part.text.trim() !== "" && (
				<ClampedText className="mt-1 text-muted-foreground">
					{part.text}
				</ClampedText>
			)}
		</div>
	);
};
