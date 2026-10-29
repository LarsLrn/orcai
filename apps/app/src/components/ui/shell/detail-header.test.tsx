import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { BotIcon } from "lucide-react";
import { DetailHeaderIcon } from "./detail-header";
import { TileMark } from "./tile";

afterEach(cleanup);

/** The CSS selectors of the well's arbitrary child variants, such as `[&_[data-slot=x]]:`. */
const childSelectors = (element: Element) => [
	...new Set(
		[
			...element.classList,
		].flatMap((className) => {
			const match = /^\[&([_>])(.+)\]:/.exec(className);
			return match
				? [
						`:scope${match[1] === "_" ? " " : " > "}${match[2].replaceAll("_", " ")}`,
					]
				: [];
		}),
	),
];

describe("DetailHeaderIcon", () => {
	test("its mark rules reach a TileMark inside the well", () => {
		const { container } = render(
			<DetailHeaderIcon>
				<BotIcon />
				<TileMark />
			</DetailHeaderIcon>,
		);
		const well = container.querySelector("[data-slot=detail-header-icon]");
		const mark = container.querySelector("[data-slot=tile-mark]");
		if (!(well && mark)) throw new Error("not rendered");

		const selectors = childSelectors(well);
		expect(selectors.length).toBeGreaterThan(0);
		for (const selector of selectors) {
			expect(well.querySelector(selector)).toBe(mark);
		}
	});
});
