import type { Answer, AskUserInput, Question } from "./ask-user";

/** A question with its number, counting from 1 across sections. */
export interface NumberedQuestion {
	number: number;
	question: Question;
}

export type FittedAnswer =
	| {
			type: "choice";
			choices: number[];
			/** The chosen options' labels, in option order. */
			labels: string[];
			other?: string;
	  }
	| {
			type: "text";
			text: string;
	  }
	| {
			type: "scale";
			value: number;
	  };

export interface AnsweredQuestion extends NumberedQuestion {
	/** Undefined when the user gave none, or gave one that does not fit the question. */
	answer: FittedAnswer | undefined;
}

export const numberedQuestions = ({
	questions,
}: Pick<AskUserInput, "questions">): NumberedQuestion[] =>
	questions.map((question, index) => ({
		number: index + 1,
		question,
	}));

const fit = (
	question: Question,
	answer: Answer | null | undefined,
	mode: AskUserInput["mode"],
): FittedAnswer | undefined => {
	if (!answer) {
		return undefined;
	}
	switch (question.type) {
		case "single":
		case "multiple": {
			if (answer.type !== "choice") return undefined;
			const choices = [
				...new Set(answer.choices),
			].sort((a, b) => a - b);
			const other = mode === "regular" ? answer.other : undefined;
			const picked = choices.length + (other === undefined ? 0 : 1);
			if (
				choices.some((choice) => choice >= question.options.length) ||
				picked === 0 ||
				(question.type === "single" && picked > 1)
			) {
				return undefined;
			}
			return {
				type: "choice",
				choices,
				labels: choices.map((choice) => question.options[choice]),
				...(other !== undefined && {
					other,
				}),
			};
		}
		case "text":
			return answer.type === "text" ? answer : undefined;
		case "scale":
			return answer.type === "scale" &&
				answer.value >= question.min &&
				answer.value <= question.max
				? answer
				: undefined;
	}
};

/** Every question with the answer the user gave it, if that answer fits. */
export const answeredQuestions = (
	input: AskUserInput,
	answers: readonly (Answer | null)[],
): AnsweredQuestion[] =>
	numberedQuestions(input).map((numbered, index) => ({
		...numbered,
		answer: fit(numbered.question, answers[index], input.mode),
	}));

export interface QuestionPage<Entry extends NumberedQuestion> {
	title: string | undefined;
	questions: Entry[];
}

/** A quiz's sections: runs of consecutive questions with the same section. */
export const quizSections = <Entry extends NumberedQuestion>(
	entries: readonly Entry[],
): QuestionPage<Entry>[] =>
	entries.reduce<QuestionPage<Entry>[]>((pages, entry) => {
		const last = pages.at(-1);
		if (last && last.title === entry.question.section) {
			last.questions.push(entry);
		} else {
			pages.push({
				title: entry.question.section,
				questions: [
					entry,
				],
			});
		}
		return pages;
	}, []);

/** What a question is worth in a quiz. */
export const pointsOf = (question: Question) => question.points ?? 1;

/** An answer as one line: the chosen labels and Other text, the text, or the value. */
export const answerLine = (answer: FittedAnswer, otherLabel = "Other") => {
	switch (answer.type) {
		case "choice":
			return [
				...answer.labels,
				...(answer.other === undefined
					? []
					: [
							`${otherLabel}: ${answer.other}`,
						]),
			].join(", ");
		case "text":
			return answer.text;
		case "scale":
			return String(answer.value);
	}
};
