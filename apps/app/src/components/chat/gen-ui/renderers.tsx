import type { ComponentType } from "react";
import type {
	DisplayToolName,
	DisplayView,
} from "@/components/chat/gen-ui/catalog";
import { Checklist } from "@/components/chat/gen-ui/checklist/checklist";
import { Matrix } from "@/components/chat/gen-ui/matrix/matrix";
import { QuizResult } from "@/components/chat/gen-ui/quiz-result/quiz-result";
import { Review } from "@/components/chat/gen-ui/review/review";

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
