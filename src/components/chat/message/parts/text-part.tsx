import { Markdown } from "@/components/chat/markdown";

interface TextPartProps {
	text: string;
	variant: "sent" | "received";
}

export const TextPart = ({ text, variant }: TextPartProps) => {
	if (variant === "sent") {
		return <div>{text}</div>;
	}

	return <Markdown className="text-foreground">{text}</Markdown>;
};
