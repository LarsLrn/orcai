import { useEffect, useRef, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { ReasoningPart } from "@/lib/ai/messages/turn-view";
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
	live: streaming,
}: {
	part: ReasoningPart;
	/** Still arriving. */
	live: boolean;
}) => {
	const duration = useStreamDuration(streaming);

	return (
		<div className="min-w-0">
			<p className="text-sm font-medium">
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
				<ClampedText className="text-muted-foreground mt-1">
					{part.text}
				</ClampedText>
			)}
		</div>
	);
};
