import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SelectableListItem } from "./selectable-list-item";

const option = {
	value: "alice",
	label: "Alice",
	description: "alice@example.com",
};

let consoleError: ReturnType<typeof spyOn>;

beforeEach(() => {
	consoleError = spyOn(console, "error");
});

afterEach(() => {
	cleanup();
	consoleError.mockRestore();
});

describe("SelectableListItem", () => {
	test("is a single toggle button with no nested control", () => {
		const { container } = render(
			<SelectableListItem
				option={option}
				onSelect={() => undefined}
				isSelected
			/>,
		);
		const row = screen.getByRole("button", {
			name: /Alice/,
		});

		expect(row.tagName).toBe("BUTTON");
		expect(row.getAttribute("aria-pressed")).toBe("true");
		expect(container.querySelectorAll("button")).toHaveLength(1);
		expect(row.querySelector("[role]")).toBeNull();
		expect(consoleError).not.toHaveBeenCalled();
	});

	test("selects its option on click", () => {
		const onSelect = mock((_: string[]) => undefined);
		render(<SelectableListItem option={option} onSelect={onSelect} />);
		const row = screen.getByRole("button", {
			name: /Alice/,
		});

		expect(row.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(row);

		expect(onSelect).toHaveBeenCalledWith([
			"alice",
		]);
	});

	test("is disabled while loading", () => {
		const onSelect = mock((_: string[]) => undefined);
		render(
			<SelectableListItem option={option} onSelect={onSelect} isLoading />,
		);
		const row = screen.getByRole("button", {
			name: /Alice/,
		});

		fireEvent.click(row);

		expect(row.hasAttribute("disabled")).toBe(true);
		expect(onSelect).not.toHaveBeenCalled();
	});
});
