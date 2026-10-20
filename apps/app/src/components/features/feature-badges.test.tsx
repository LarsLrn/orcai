import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { m } from "@/paraglide/messages";
import { FeatureBadges } from "./feature-badges";

afterEach(() => {
	cleanup();
});

describe("FeatureBadges", () => {
	test("renders nothing without enabled features", () => {
		const { container } = render(<FeatureBadges features={{}} />);

		expect(container.innerHTML).toBe("");
	});

	test("shows each enabled feature with its description as title", () => {
		render(
			<FeatureBadges
				features={{
					generativeUi: {},
				}}
			/>,
		);

		const badge = screen.getByText("Generative UI");
		expect(badge.getAttribute("title")).toBe(
			m.feature_generative_ui_description(),
		);
	});
});
