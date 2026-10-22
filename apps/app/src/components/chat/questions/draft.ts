import type {
	Answer,
	AskUserInput,
	Question,
} from "@/lib/ai/tools/questions/ask-user";
import { pointsOf } from "@/lib/ai/tools/questions/questionnaire";

/** What the user has put in for one question so far; Other is chosen while `other` is set. */
export interface Draft {
	choices: number[];
	other?: string;
	text: string;
	value?: number;
}

export const emptyDraft = (): Draft => ({
	choices: [],
	text: "",
});

/** The answer a draft gives its question; null while it gives none. */
export const draftAnswer = (
	question: Question,
	draft: Draft,
): Answer | null => {
	switch (question.type) {
		case "single":
		case "multiple": {
			const other = draft.other?.trim() || undefined;
			return draft.choices.length > 0 || other !== undefined
				? {
						type: "choice",
						choices: draft.choices,
						...(other !== undefined && {
							other,
						}),
					}
				: null;
		}
		case "text": {
			const text = draft.text.trim();
			return text
				? {
						type: "text",
						text,
					}
				: null;
		}
		case "scale":
			return draft.value === undefined
				? null
				: {
						type: "scale",
						value: draft.value,
					};
	}
};

export const draftAnswers = (
	{ questions }: Pick<AskUserInput, "questions">,
	drafts: readonly Draft[],
) =>
	questions.map((question, index) =>
		draftAnswer(question, drafts[index] ?? emptyDraft()),
	);

/** Picks an option: a single choice replaces the pick and Other, a multiple choice toggles it. */
export const toggleChoice = (
	question: Question,
	draft: Draft,
	choice: number,
): Draft => {
	if (question.type !== "multiple") {
		return {
			...draft,
			choices: [
				choice,
			],
			other: undefined,
		};
	}
	const choices = draft.choices.includes(choice)
		? draft.choices.filter((chosen) => chosen !== choice)
		: [
				...draft.choices,
				choice,
			].sort((a, b) => a - b);
	return {
		...draft,
		choices,
	};
};

/** Chooses Other with its text, or drops it; a single choice drops its pick. */
export const setOther = (
	question: Question,
	draft: Draft,
	other: string | undefined,
): Draft => ({
	...draft,
	choices:
		question.type === "single" && other !== undefined ? [] : draft.choices,
	other,
});

/** Points show on a quiz's questions only when they differ. */
export const pointsVary = ({ questions }: Pick<AskUserInput, "questions">) =>
	new Set(questions.map(pointsOf)).size > 1;
