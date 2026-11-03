import type { ComponentType } from "react";
import { Checklist } from "@/components/chat/gen-ui/checklist/checklist";
import { Matrix } from "@/components/chat/gen-ui/matrix/matrix";
import { QuizResult } from "@/components/chat/gen-ui/quiz-result/quiz-result";
import { Review } from "@/components/chat/gen-ui/review/review";
import type {
	DisplayToolName,
	DisplayView,
} from "@/lib/ai/tools/gen-ui/catalog";

export type DisplayRendererProps<Name extends DisplayToolName> = {
	view: DisplayView<Name>;
	streaming: boolean;
};

export type DisplayRenderers = {
	[Name in DisplayToolName]: ComponentType<DisplayRendererProps<Name>>;
};

export const displayRenderers: DisplayRenderers = {
	showChecklist: Checklist,
	showReview: Review,
	showMatrix: Matrix,
	showQuizResult: QuizResult,
};
