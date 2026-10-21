import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { Markdown } from "./markdown";

afterEach(cleanup);

describe("Markdown code", () => {
	test("keeps inline code in its paragraph", () => {
		const { container } = render(<Markdown>{"Run `ls` here."}</Markdown>);

		expect(container.querySelector("p code")?.textContent).toBe("ls");
		expect(container.querySelector("pre")).toBeNull();
	});

	test("renders a fenced block as a code block", () => {
		const { container } = render(
			<Markdown>{"```ts\nconst a = 1;\nconst b = 2;\n```"}</Markdown>,
		);

		const block = container.querySelector('[data-slot="code-block"]');
		expect(
			block?.querySelectorAll('[data-slot="code-block-line"]'),
		).toHaveLength(2);
		expect(block?.textContent).toContain("const b = 2;");
	});
});
