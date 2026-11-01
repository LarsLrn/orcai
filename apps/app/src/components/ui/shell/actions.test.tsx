import { afterEach, describe, expect, mock, test } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { type HeaderAction, HeaderActions } from "./actions";

afterEach(cleanup);

const action = (
	key: string,
	options: Partial<Pick<HeaderAction, "overflow" | "destructive">> = {},
): HeaderAction => ({
	key,
	label: key,
	onClick: mock(() => undefined),
	...options,
});

const inlineLabels = () =>
	Array.from(
		document.querySelectorAll('[data-slot="header-actions-inline"] button'),
	).map((button) => button.textContent);

const menuTrigger = () =>
	screen.queryByRole("button", {
		name: "More actions",
	});

const openMenu = async () => {
	const trigger = menuTrigger();
	if (!trigger) throw new Error("no menu trigger");
	await act(() => {
		fireEvent.click(trigger);
	});
	return screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
};

describe("HeaderActions", () => {
	test("renders nothing without actions", () => {
		const { container } = render(
			<HeaderActions
				actions={[
					false,
					null,
					undefined,
				]}
			/>,
		);

		expect(container.innerHTML).toBe("");
	});

	test("keeps declaration order inline and leaves out falsy entries", () => {
		render(
			<HeaderActions
				actions={[
					action("Start"),
					false,
					action("Edit"),
					action("Access"),
				]}
			/>,
		);

		expect(inlineLabels()).toEqual([
			"Start",
			"Edit",
			"Access",
		]);
		expect(menuTrigger()).toBeNull();
	});

	test("shows a single harmless overflow action inline", () => {
		render(
			<HeaderActions
				actions={[
					action("Edit"),
					action("Prepare again", {
						overflow: true,
					}),
				]}
			/>,
		);

		expect(inlineLabels()).toEqual([
			"Edit",
			"Prepare again",
		]);
		expect(menuTrigger()).toBeNull();
	});

	test("keeps a lone destructive action behind the menu", async () => {
		render(
			<HeaderActions
				actions={[
					action("Edit"),
					action("Delete", {
						destructive: true,
					}),
				]}
			/>,
		);

		expect(inlineLabels()).toEqual([
			"Edit",
		]);
		expect(await openMenu()).toEqual([
			"Delete",
		]);
	});

	test("puts overflow actions in the menu, destructive ones last", async () => {
		render(
			<HeaderActions
				actions={[
					action("Delete", {
						destructive: true,
					}),
					action("Download"),
					action("Prepare again", {
						overflow: true,
					}),
					action("Archive", {
						overflow: true,
					}),
				]}
			/>,
		);

		expect(inlineLabels()).toEqual([
			"Download",
		]);
		expect(await openMenu()).toEqual([
			"Prepare again",
			"Archive",
			"Delete",
		]);
	});

	test("renders the menu without inline buttons", async () => {
		render(
			<HeaderActions
				actions={[
					action("Deactivate", {
						destructive: true,
					}),
				]}
			/>,
		);

		expect(
			document.querySelector('[data-slot="header-actions-inline"]'),
		).toBeNull();
		expect(await openMenu()).toEqual([
			"Deactivate",
		]);
	});
});
