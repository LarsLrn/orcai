import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { MultiSelect } from "./multi-select";

const options = [
	{
		value: "vision",
		label: "Vision",
	},
	{
		value: "tools",
		label: "Tools",
	},
	{
		value: "reasoning",
		label: "Reasoning",
	},
];

let consoleError: ReturnType<typeof spyOn>;

beforeEach(() => {
	consoleError = spyOn(console, "error");
});

afterEach(() => {
	cleanup();
	consoleError.mockRestore();
});

const renderMultiSelect = (defaultValue: string[] = []) => {
	const onValueChange = mock((_: string[]) => undefined);
	const view = render(
		<MultiSelect
			options={options}
			defaultValue={defaultValue}
			onValueChange={onValueChange}
		/>,
	);
	return {
		...view,
		onValueChange,
		trigger: screen.getByRole("combobox"),
	};
};

describe("MultiSelect", () => {
	test("keeps its remove controls out of any button", () => {
		const { container, trigger } = renderMultiSelect([
			"vision",
			"tools",
		]);

		expect(trigger.tagName).not.toBe("BUTTON");
		expect(container.querySelector("button button")).toBeNull();
		expect(
			screen.getByRole("button", {
				name: "Remove Vision from selection",
			}),
		).toBeDefined();
		expect(consoleError).not.toHaveBeenCalled();
	});

	test("removes a chip without opening the popover", () => {
		const { onValueChange, trigger } = renderMultiSelect([
			"vision",
			"tools",
		]);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Remove Vision from selection",
			}),
		);

		expect(onValueChange).toHaveBeenLastCalledWith([
			"tools",
		]);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	test("clears every selection", () => {
		const { onValueChange } = renderMultiSelect([
			"vision",
			"tools",
		]);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Clear all 2 selected options",
			}),
		);

		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});

	test("opens from the keyboard and by click", async () => {
		const { trigger } = renderMultiSelect();

		expect(trigger.getAttribute("tabindex")).toBe("0");
		fireEvent.keyDown(trigger, {
			key: "Enter",
		});
		expect(trigger.getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(trigger);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");

		fireEvent.keyUp(trigger, {
			key: " ",
		});
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		await act(() => Promise.resolve());
	});

	test("cannot be opened when disabled", () => {
		const onValueChange = mock((_: string[]) => undefined);
		render(
			<MultiSelect options={options} onValueChange={onValueChange} disabled />,
		);
		const trigger = screen.getByRole("combobox");

		fireEvent.click(trigger);

		expect(trigger.getAttribute("aria-disabled")).toBe("true");
		expect(trigger.getAttribute("tabindex")).toBe("-1");
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});
});
