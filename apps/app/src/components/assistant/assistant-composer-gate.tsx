import type { ReactNode } from "react";
import { AssistantUnavailable } from "@/components/assistant/assistant-unavailable";
import { useAssistantModel } from "@/components/assistant/use-assistant-model";

/** A conversation keeps its transcript without a model; only the composer gives way. */
const AssistantComposerGate = ({ children }: { children: ReactNode }) => {
	const { availability } = useAssistantModel();

	if (availability === "unset") {
		return <AssistantUnavailable variant="inline" />;
	}

	return <>{children}</>;
};

export { AssistantComposerGate };
