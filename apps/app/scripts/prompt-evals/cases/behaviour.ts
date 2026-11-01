import de from "../../../messages/de.json";
import en from "../../../messages/en.json";
import {
	answersIn,
	calls,
	cites,
	citesNothing,
	citesOnly,
	judged,
	noOtherCitationStyle,
	noSourceList,
	omits,
} from "../checks";
import { runChat } from "../harness";
import type { EvalCase } from "./case";
import { A_DATE, etAl, search, study, twoAuthors } from "./chat";

/** The example before it followed the platform's rules. */
const OLD_EXAMPLE = `You are the course assistant for this module.

Answer only from the repositories attached to you, and name the document each answer came from. If the material does not cover the question, say so and point the person to the course team.

Keep answers short and plain. Use British English.

Refuse anything outside the course material: do not grade work, do not predict marks, and do not give personal, legal or medical advice.`;

const examples = {
	old: OLD_EXAMPLE,
	en: en.authoring_behaviour_example,
	de: de.authoring_behaviour_example,
};

const questions = {
	"covered-en": {
		language: "en",
		message: "How do I cite a source with three authors in the text?",
	},
	"covered-de": {
		language: "de",
		message: "Wie zitiere ich im Text eine Quelle mit drei Autoren?",
	},
	"uncovered-en": {
		language: "en",
		message: "When is the deadline for the final essay?",
	},
	"uncovered-de": {
		language: "de",
		message: "Bis wann muss ich den Aufsatz am Ende des Kurses abgeben?",
	},
} as const;

const exampleCase = (
	variant: keyof typeof examples,
	key: keyof typeof questions,
): EvalCase => {
	const { language, message } = questions[key];
	const covered = key.startsWith("covered");

	return {
		id: `behaviour/example-${variant}-${key}`,
		run: (model) =>
			runChat({
				model,
				...study(message, covered ? search(etAl, twoAuthors) : search()),
				behaviour: examples[variant],
			}),
		checks: [
			calls("searchRepositories"),
			answersIn(language),
			noOtherCitationStyle,
			noSourceList,
			...(covered
				? [
						cites,
						citesOnly([
							etAl.ref,
							twoAuthors.ref,
						]),
					]
				: [
						citesNothing,
						omits(A_DATE),
						judged(
							"says the material lacks the deadline and asserts none",
							"Does the answer say that the course material does not contain the deadline for the final essay, and does it avoid asserting any deadline, absolute or relative (such as a date, a weekday, 'tomorrow' or 'in two weeks')?",
						),
					]),
		],
	};
};

export const behaviourCases: EvalCase[] = (
	Object.keys(examples) as (keyof typeof examples)[]
).flatMap((variant) =>
	(Object.keys(questions) as (keyof typeof questions)[]).map((key) =>
		exampleCase(variant, key),
	),
);
