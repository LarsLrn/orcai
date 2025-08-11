import type { TextPart } from "ai";
import { Response } from "@/components/ai-elements/response";

const ResponsePart = ({ part }: { part: TextPart }) => {
	return <Response className="text-foreground">{part.text}</Response>;
};

export { ResponsePart };
