import { createContext } from "react";
import type { StepAnswers } from "@/lib/ai/chat-session/chat-session";

/** The latest reply's answers; a widget gets them only while the view marks its call answerable. */
export const StepAnswersContext = createContext<StepAnswers | undefined>(
	undefined,
);
