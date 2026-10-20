import type { DeepPartial } from "ai";
import type { ComponentType } from "react";
import type {
	DisplayToolInput,
	DisplayToolName,
} from "@/components/chat/gen-ui/catalog";
import { Checklist } from "@/components/chat/gen-ui/checklist/checklist";
import { Matrix } from "@/components/chat/gen-ui/matrix/matrix";
import { Review } from "@/components/chat/gen-ui/review/review";

export type DisplayRendererProps<Name extends DisplayToolName> = {
	input: DeepPartial<DisplayToolInput<Name>>;
	streaming: boolean;
};

export type DisplayRenderers = {
	[Name in DisplayToolName]: ComponentType<DisplayRendererProps<Name>>;
};

export const displayRenderers: DisplayRenderers = {
	showChecklist: Checklist,
	showReview: Review,
	showMatrix: Matrix,
};
