import { afterEach, describe, expect, test } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { useAppForm } from "@/hooks/form";
import CheckboxField from "./checkbox-field";
import CodeField from "./code-field";
import DatetimeField from "./datetime-field";
import MultiSelectField from "./multi-select-field";
import PasswordField from "./password-field";
import SelectField from "./select-field";
import SliderField from "./slider-field";
import SwitchField from "./switch-field";
import TextField from "./text-field";
import TextareaField from "./textarea-field";

afterEach(cleanup);

const HINT = "A hint read before the control.";
const ERROR = "This needs a value.";

const descriptionOf = (element: HTMLElement) =>
	(element.getAttribute("aria-describedby") ?? "")
		.split(" ")
		.filter(Boolean)
		.map((id) => document.getElementById(id)?.textContent ?? `#${id} missing`);

const submit = () =>
	act(() => {
		fireEvent.click(
			screen.getByRole("button", {
				name: "Submit",
			}),
		);
	});

/** A one-field form whose field fails on submit. */
const SingleFieldForm = ({
	children,
	defaultValue,
}: {
	children: React.ReactNode;
	defaultValue: unknown;
}) => {
	const form = useAppForm({
		defaultValues: {
			value: defaultValue,
		},
	});

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				form.handleSubmit();
			}}
		>
			<form.AppField
				name="value"
				validators={{
					onSubmit: () => ({
						message: ERROR,
					}),
				}}
				children={() => children}
			/>
			<button type="submit">Submit</button>
		</form>
	);
};

const cases: {
	name: string;
	defaultValue: unknown;
	field: React.ReactNode;
	control: () => HTMLElement;
}[] = [
	{
		name: "TextField",
		defaultValue: "",
		field: <TextField label="Name" description={HINT} />,
		control: () => screen.getByRole("textbox"),
	},
	{
		name: "TextField with a number",
		defaultValue: undefined,
		field: (
			<TextField
				label="Budget"
				description={HINT}
				type="number"
				unit="tokens"
			/>
		),
		control: () => screen.getByRole("spinbutton"),
	},
	{
		name: "TextareaField",
		defaultValue: "",
		field: <TextareaField label="Description" description={HINT} />,
		control: () => screen.getByRole("textbox"),
	},
	{
		name: "PasswordField",
		defaultValue: "",
		field: <PasswordField label="API key" description={HINT} />,
		control: () => screen.getByLabelText("API key"),
	},
	{
		name: "SelectField",
		defaultValue: "",
		field: (
			<SelectField
				label="Period"
				description={HINT}
				options={[
					{
						value: "weekly",
						label: "Weekly",
					},
				]}
			/>
		),
		control: () => screen.getByRole("combobox"),
	},
	{
		name: "MultiSelectField",
		defaultValue: [],
		field: (
			<MultiSelectField
				label="Groups"
				description={HINT}
				options={[
					{
						value: "staff",
						label: "Staff",
					},
				]}
			/>
		),
		control: () => screen.getByRole("combobox"),
	},
	{
		name: "SwitchField",
		defaultValue: false,
		field: <SwitchField label="Active" description={HINT} />,
		control: () => screen.getByRole("switch"),
	},
	{
		name: "CodeField",
		defaultValue: "",
		field: <CodeField label="Code" description={HINT} />,
		control: () => screen.getByRole("textbox"),
	},
	{
		name: "DatetimeField",
		defaultValue: null,
		field: <DatetimeField label="Expires" description={HINT} />,
		control: () => screen.getByLabelText("Expires"),
	},
	{
		name: "SliderField",
		defaultValue: 0.5,
		field: (
			<SliderField
				label="Temperature"
				description={HINT}
				min={0}
				max={1}
				// happy-dom calls 0.5 a step mismatch of 0.1 and blocks the submit.
				step={0.25}
				restingValue={0.5}
			/>
		),
		// The range input is visually hidden behind the thumb.
		control: () =>
			screen.getByRole("slider", {
				hidden: true,
			}),
	},
];

describe("form fields reference their hint and error", () => {
	for (const fieldCase of cases) {
		test(fieldCase.name, async () => {
			render(
				<SingleFieldForm defaultValue={fieldCase.defaultValue}>
					{fieldCase.field}
				</SingleFieldForm>,
			);

			expect(descriptionOf(fieldCase.control())).toEqual([
				HINT,
			]);

			await submit();

			expect(descriptionOf(fieldCase.control())).toEqual([
				HINT,
				ERROR,
			]);
		});
	}

	test("a field without a hint references only its error", async () => {
		render(
			<SingleFieldForm defaultValue={false}>
				<CheckboxField label="Trust" />
			</SingleFieldForm>,
		);
		const checkbox = () => screen.getByRole("checkbox");

		expect(checkbox().hasAttribute("aria-describedby")).toBe(false);

		await submit();

		expect(descriptionOf(checkbox())).toEqual([
			ERROR,
		]);
	});
});
