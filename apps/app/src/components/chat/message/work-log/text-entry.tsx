import type { TextPart } from "@/components/chat/message/classify-turn";
import { ClampedText } from "./clamped-text";

/** An intermediate response the model emitted before its answer. */
export const TextEntry = ({ part }: { part: TextPart }) => (
	<ClampedText className="text-foreground/85">{part.text}</ClampedText>
);
