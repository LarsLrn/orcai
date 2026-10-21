import type { TextPart } from "@/lib/ai/turn-view/turn-view";
import { ClampedText } from "./clamped-text";

/** An intermediate response the model emitted before its answer. */
export const TextEntry = ({ part }: { part: TextPart }) => (
	<ClampedText className="text-foreground/85">{part.text}</ClampedText>
);
