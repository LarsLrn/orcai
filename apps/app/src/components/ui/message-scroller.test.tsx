import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useMessageScrollerInView } from "./message-scroller";

const { getBoundingClientRect } = HTMLElement.prototype;

beforeEach(() => {
	// happy-dom lays nothing out; elements take their box from data attributes.
	HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
		const top = Number(this.dataset.top ?? 0);
		const height = Number(this.dataset.height ?? 10);
		return {
			top,
			bottom: top + height,
		} as DOMRect;
	};
});

afterEach(() => {
	cleanup();
	HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect;
});

const Probe = ({ watched }: { watched: string[] }) => {
	const [ref, inView] = useMessageScrollerInView();

	return (
		<div
			data-slot="message-scroller-viewport"
			data-testid="viewport"
			data-height="100"
		>
			<div>
				{[
					"a",
					"b",
				].map((id) => (
					<p
						key={id}
						data-testid={id}
						data-top="200"
						ref={watched.includes(id) ? ref : undefined}
					/>
				))}
			</div>
			<output>{String(inView)}</output>
		</div>
	);
};

const moveTo = (id: string, top: number) => {
	screen.getByTestId(id).dataset.top = String(top);
	fireEvent.scroll(screen.getByTestId("viewport"));
};

const shown = () => screen.getByRole("status").textContent;

describe("useMessageScrollerInView", () => {
	test("is in view while any watched element is", () => {
		render(
			<Probe
				watched={[
					"a",
					"b",
				]}
			/>,
		);
		expect(shown()).toBe("false");

		moveTo("b", 50);
		expect(shown()).toBe("true");

		moveTo("a", 20);
		moveTo("b", 200);
		expect(shown()).toBe("true");

		moveTo("a", -40);
		expect(shown()).toBe("false");
	});

	test("forgets an element once it leaves the ref", () => {
		const { rerender } = render(
			<Probe
				watched={[
					"a",
				]}
			/>,
		);
		moveTo("a", 50);
		expect(shown()).toBe("true");

		rerender(<Probe watched={[]} />);
		expect(shown()).toBe("false");

		moveTo("a", 60);
		expect(shown()).toBe("false");
	});
});
