import { afterEach, describe, expect, mock, test } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import type { HeaderAction } from "./actions";
import { Tile, TileBody, TileMenu, TileTitle } from "./tile";

afterEach(cleanup);

const action = (
	key: string,
	options: Partial<Pick<HeaderAction, "destructive" | "overflow">> = {},
): HeaderAction => ({
	key,
	label: key,
	onClick: mock(() => undefined),
	...options,
});

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
};

const renderTile = ({
	actions,
	star,
	onOpen = () => undefined,
}: {
	actions: (HeaderAction | false)[];
	star?: boolean;
	onOpen?: () => void;
}) =>
	render(
		<Tile>
			<TileBody>
				<TileTitle
					action={{
						onClick: onOpen,
					}}
				>
					Name
				</TileTitle>
			</TileBody>
			<TileMenu actions={actions}>
				{star ? <button type="button">Star</button> : null}
			</TileMenu>
		</Tile>,
	);

describe("TileMenu", () => {
	test("renders no cluster without controls or actions", () => {
		const { container } = renderTile({
			actions: [
				false,
			],
		});

		expect(container.querySelector('[data-slot="tile-menu"]')).toBeNull();
	});

	test("keeps a single harmless action in the menu", async () => {
		renderTile({
			actions: [
				action("Edit"),
			],
		});

		expect(
			screen.queryByRole("button", {
				name: "Edit",
			}),
		).toBeNull();
		await openMenu();
		expect(
			screen.getAllByRole("menuitem").map((item) => item.textContent),
		).toEqual([
			"Edit",
		]);
	});

	test("puts destructive actions below a separator", async () => {
		renderTile({
			actions: [
				action("Delete", {
					destructive: true,
				}),
				action("Edit"),
				action("Access"),
			],
		});

		await openMenu();
		const menu = screen.getByRole("menu");
		const entries = Array.from(
			menu.querySelectorAll('[role="menuitem"], [role="separator"]'),
		).map((entry) =>
			entry.getAttribute("role") === "separator" ? "---" : entry.textContent,
		);

		expect(entries).toEqual([
			"Edit",
			"Access",
			"---",
			"Delete",
		]);
	});

	test("comes after the title in tab order, and opening it leaves the tile closed", async () => {
		const onOpen = mock(() => undefined);
		renderTile({
			actions: [
				action("Edit"),
			],
			star: true,
			onOpen,
		});

		expect(
			screen.getAllByRole("button").map((button) => button.textContent),
		).toEqual([
			"Name",
			"Star",
			"",
		]);
		await openMenu();
		expect(onOpen).not.toHaveBeenCalled();
	});
});

describe("TileTitle", () => {
	test("is a toggle when pressed is given", () => {
		render(
			<TileTitle
				action={{
					onClick: () => undefined,
				}}
				pressed
			>
				Chosen
			</TileTitle>,
		);

		expect(
			screen
				.getByRole("button", {
					name: "Chosen",
				})
				.getAttribute("aria-pressed"),
		).toBe("true");
	});

	test("stays focusable and busy while loading", () => {
		render(
			<TileTitle
				action={{
					onClick: () => undefined,
					loading: true,
				}}
			>
				Selecting
			</TileTitle>,
		);
		const button = screen.getByRole("button", {
			name: "Selecting",
		});

		expect(button.getAttribute("aria-busy")).toBe("true");
		button.focus();
		expect(document.activeElement).toBe(button);
	});
});
