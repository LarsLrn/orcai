import { useEffect, useRef, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { ReasoningPart } from "@/components/chat/message/classify-turn";
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

export const ReasoningEntry = ({ part }: { part: ReasoningPart }) => {
	const streaming = part.state === "streaming";
	const duration = useStreamDuration(streaming);

	return (
		<div className="min-w-0">
			<p className="font-medium text-sm">
				{streaming ? (
					<Shimmer as="span" duration={1}>
						Thinking
					</Shimmer>
				) : duration === undefined ? (
					"Thought for a few seconds"
				) : (
					`Thought for ${duration} ${duration === 1 ? "second" : "seconds"}`
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
