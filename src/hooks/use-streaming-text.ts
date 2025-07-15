import { useEffect, useRef, useState } from "react";

export type DataStreamDelta = {
	type:
		| "text-delta"
		| "code-delta"
		| "image-delta"
		| "title"
		| "id"
		| "suggestion"
		| "clear"
		| "finish"
		| "user-message-id"
		| "kind";
	content: string;
};

interface ToolStream {
	[key: string]: {
		content: string | undefined;
	};
}

export function useStreamingText(dataStream: DataStreamDelta[] | undefined) {
	const [toolStream, setToolStream] = useState<ToolStream | null>(null);
	const lastProcessedIndex = useRef(-1);
	const accumulatedResponse = useRef<{ [key: string]: string }>({});
	const frameRequestRef = useRef<number>(null);

	useEffect(() => {
		if (!dataStream?.length) return;

		const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
		lastProcessedIndex.current = dataStream.length - 1;

		(newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
			if (delta.type === "id") {
				if (!accumulatedResponse.current[delta.content]) {
					accumulatedResponse.current[delta.content] = "";
				}
			}

			if (delta.type === "text-delta") {
				const id = Object.keys(accumulatedResponse.current)[0];
				accumulatedResponse.current[id] += delta.content;

				if (frameRequestRef.current) {
					cancelAnimationFrame(frameRequestRef.current);
				}

				frameRequestRef.current = requestAnimationFrame(() => {
					setToolStream((prev) => ({
						...prev,
						[id]: { content: accumulatedResponse.current[id] },
					}));
				});
			}

			if (delta.type === "finish") {
				accumulatedResponse.current = {};
				setToolStream(null);
			}
		});

		return () => {
			if (frameRequestRef.current) {
				cancelAnimationFrame(frameRequestRef.current);
			}
		};
	}, [dataStream]);

	const reset = () => {
		setToolStream(null);
		accumulatedResponse.current = {};
	};

	return { toolStream, reset };
}
