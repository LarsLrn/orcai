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
});
