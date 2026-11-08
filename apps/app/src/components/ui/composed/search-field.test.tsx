import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { m } from "@/paraglide/messages";
import { SearchField } from "./search-field";

afterEach(cleanup);

describe("SearchField", () => {
	test("Clear empties the search", () => {
		const onValueChange = mock((_value: string) => undefined);
		render(<SearchField value="ada" onValueChange={onValueChange} />);

		fireEvent.click(
			screen.getByRole("button", {
				name: m.data_table_search_clear_label(),
			}),
		);

		expect(onValueChange).toHaveBeenCalledWith("");
	});

	test("a disabled field cannot be cleared either", () => {
		const onValueChange = mock((_value: string) => undefined);
		render(<SearchField value="ada" onValueChange={onValueChange} disabled />);

		expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(
			true,
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: m.data_table_search_clear_label(),
			}),
		);

		expect(onValueChange).not.toHaveBeenCalled();
	});
});
