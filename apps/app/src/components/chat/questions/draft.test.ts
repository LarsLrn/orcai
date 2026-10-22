import { describe, expect, test } from "bun:test";
import {
	capitalsQuiz,
	clarifyingRound,
} from "@/lib/ai/tools/questions/fixtures";
import {
	draftAnswer,
	draftAnswers,
	emptyDraft,
	pointsVary,
	setOther,
	toggleChoice,
} from "./draft";

const [single, multiple, text, scale] = clarifyingRound.questions;

describe("drafts", () => {
	test("a single choice keeps one pick, and Other replaces it", () => {
		const picked = toggleChoice(
			single,
			toggleChoice(single, emptyDraft(), 0),
			1,
		);
		expect(draftAnswer(single, picked)).toEqual({
			type: "choice",
			choices: [
				1,
			],
		});

		const other = setOther(single, picked, " Alumni ");
		expect(draftAnswer(single, other)).toEqual({
			type: "choice",
			choices: [],
			other: "Alumni",
		});
		expect(draftAnswer(single, toggleChoice(single, other, 0))).toEqual({
			type: "choice",
			choices: [
				0,
			],
		});
	});

	test("a multiple choice toggles picks and keeps Other beside them", () => {
		const draft = setOther(
			multiple,
			toggleChoice(
				multiple,
				toggleChoice(multiple, toggleChoice(multiple, emptyDraft(), 2), 0),
				2,
			),
			"Citations",
		);

		expect(draftAnswer(multiple, draft)).toEqual({
			type: "choice",
			choices: [
				0,
			],
			other: "Citations",
		});
	});

	test("empty input gives no answer", () => {
		expect(
			draftAnswer(single, setOther(single, emptyDraft(), "  ")),
		).toBeNull();
		expect(
			draftAnswer(text, {
				...emptyDraft(),
				text: " ",
			}),
		).toBeNull();
		expect(draftAnswers(clarifyingRound, [])).toEqual([
			null,
			null,
			null,
			null,
		]);
		expect(
			draftAnswer(scale, {
				...emptyDraft(),
				value: 1,
			}),
		).toEqual({
			type: "scale",
			value: 1,
		});
	});

	test("points show only when they differ", () => {
		expect(pointsVary(capitalsQuiz)).toBe(true);
		expect(pointsVary(clarifyingRound)).toBe(false);
	});
});
