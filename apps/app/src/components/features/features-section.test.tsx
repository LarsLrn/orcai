import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Features } from "@orcai/schema";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FeaturesSection } from "./features-section";

afterEach(() => {
	cleanup();
});

const generativeUiSwitch = () =>
	screen.getByRole("switch", {
		name: "Generative UI",
	});

describe("FeaturesSection", () => {
	test("enabling a feature adds it with empty settings", () => {
		const onChange = mock((_: Features) => undefined);
		render(<FeaturesSection value={{}} onChange={onChange} />);

		expect(generativeUiSwitch().getAttribute("aria-checked")).toBe("false");
		fireEvent.click(generativeUiSwitch());

		expect(onChange).toHaveBeenLastCalledWith({
			generativeUi: {},
		});
	});

	test("disabling a feature removes its key", () => {
		const onChange = mock((_: Features) => undefined);
		render(
			<FeaturesSection
				value={{
					generativeUi: {},
				}}
				onChange={onChange}
			/>,
		);

		expect(generativeUiSwitch().getAttribute("aria-checked")).toBe("true");
		fireEvent.click(generativeUiSwitch());

		expect(onChange).toHaveBeenLastCalledWith({});
	});

	test("is read-only without onChange", () => {
		render(
			<FeaturesSection
				value={{
					generativeUi: {},
				}}
			/>,
		);

		fireEvent.click(generativeUiSwitch());

		expect(generativeUiSwitch().getAttribute("aria-checked")).toBe("true");
		expect(generativeUiSwitch().getAttribute("aria-readonly")).toBe("true");
	});

	test("enabling web search starts with the whole web", () => {
		const onChange = mock((_: Features) => undefined);
		render(<FeaturesSection value={{}} onChange={onChange} />);

		fireEvent.click(
			screen.getByRole("switch", {
				name: "Web search",
			}),
		);

		expect(onChange).toHaveBeenLastCalledWith({
			webSearch: {
				allowedDomains: [],
			},
		});
	});

	test("an allowed domain is added as its host name and removed again", () => {
		const onChange = mock((_: Features) => undefined);
		const value: Features = {
			webSearch: {
				allowedDomains: [
					"example.org",
				],
			},
		};
		render(<FeaturesSection value={value} onChange={onChange} />);

		fireEvent.change(
			screen.getByRole("textbox", {
				name: "Allowed domains",
			}),
			{
				target: {
					value: "https://Docs.Example.net/guide",
				},
			},
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Add",
			}),
		);
		expect(onChange).toHaveBeenLastCalledWith({
			webSearch: {
				allowedDomains: [
					"example.org",
					"docs.example.net",
				],
			},
		});

		fireEvent.click(
			screen.getByRole("button", {
				name: "Remove example.org",
			}),
		);
		expect(onChange).toHaveBeenLastCalledWith({
			webSearch: {
				allowedDomains: [],
			},
		});
	});

	test("a text that is no domain is refused", () => {
		const onChange = mock((_: Features) => undefined);
		render(
			<FeaturesSection
				value={{
					webSearch: {
						allowedDomains: [],
					},
				}}
				onChange={onChange}
			/>,
		);

		fireEvent.change(
			screen.getByRole("textbox", {
				name: "Allowed domains",
			}),
			{
				target: {
					value: "not a domain",
				},
			},
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Add",
			}),
		);

		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toBe(
			"Enter a domain such as example.org.",
		);
	});
});
