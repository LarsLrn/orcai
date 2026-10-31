import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AskUserInput } from "@/lib/ai/tools/questions/ask-user";
import { m } from "@/paraglide/messages";
import { QuestionStepper } from "./question-stepper";

afterEach(cleanup);

const input: AskUserInput = {
	mode: "regular",
	questions: [
		{
			type: "text",
			prompt: "What should it never do?",
		},
		{
			type: "single",
			prompt: "Who is it for?",
			options: [
				"Students",
				"Staff",
			],
		},
	],
};

const button = (name: string) =>
	screen.queryByRole("button", {
		name,
	});

const renderStepper = () => {
	const onSubmit = mock(() => undefined);
	render(
		<QuestionStepper
			input={input}
			onSubmit={onSubmit}
			onSkip={() => undefined}
		/>,
	);
	return onSubmit;
};

describe("QuestionStepper", () => {
	test("offers Submit only on the review after the last question", () => {
		const onSubmit = renderStepper();

		for (const step of [
			1,
			2,
		]) {
			expect(
				screen.getByText(
					m.questions_step_progress({
						step,
						count: 2,
					}),
				),
			).toBeTruthy();
			expect(button(m.questions_submit_action())).toBeNull();
			fireEvent.click(button(m.questions_next_action()) as HTMLElement);
		}

		expect(screen.getByText(m.questions_review_title())).toBeTruthy();
		expect(button(m.questions_next_action())).toBeNull();
		fireEvent.click(button(m.questions_submit_action()) as HTMLElement);
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	test("picking a single choice on the last question opens the review without submitting", () => {
		const onSubmit = renderStepper();
		fireEvent.click(button(m.questions_next_action()) as HTMLElement);

		fireEvent.click(
			screen.getByRole("radio", {
				name: "Staff",
			}),
		);

		expect(screen.getByText(m.questions_review_title())).toBeTruthy();
		expect(screen.getByText("Staff")).toBeTruthy();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	test("Enter on the last question neither moves on nor submits", () => {
		const onSubmit = renderStepper();
		fireEvent.click(button(m.questions_next_action()) as HTMLElement);

		fireEvent.keyDown(screen.getByRole("textbox"), {
			key: "Enter",
		});
		fireEvent.keyDown(
			screen.getByRole("radio", {
				name: "Students",
			}),
			{
				key: "Enter",
			},
		);

		expect(
			screen.getByText(
				m.questions_step_progress({
					step: 2,
					count: 2,
				}),
			),
		).toBeTruthy();
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
