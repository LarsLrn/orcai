import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import {
	normaliseMathDelimiters,
	StreamdownContent,
} from "./streamdown-content";

afterEach(cleanup);

describe("normaliseMathDelimiters", () => {
	test.each([
		[
			"inline math in a sentence",
			"Pythagoras: \\(a^2+b^2=c^2\\) holds.",
			"Pythagoras: $$a^2+b^2=c^2$$ holds.",
		],
		[
			"display math on its own line",
			"\\[\\sum_{k=0}^{n}\\binom{n}{k}=2^n\\]",
			"$$\n\\sum_{k=0}^{n}\\binom{n}{k}=2^n\n$$",
		],
		[
			"display math within a sentence",
			"Then \\[x=1\\] holds.",
			"Then\n$$\nx=1\n$$\nholds.",
		],
		[
			"display delimiters on their own lines",
			"\\[\na \\\\\nb\n\\]\nAfter",
			"$$\na \\\\\nb\n$$\nAfter",
		],
		[
			"display math continuing a list item",
			"1. Sum:\n   \\[\n   x\n   \\]",
			"1. Sum:\n   $$\n   x\n   $$",
		],
		[
			"display math on a list item line",
			"- Sum \\[x\\] holds",
			"- Sum\n  $$\n  x\n  $$\n  holds",
		],
		[
			"display math in a quote",
			"> So \\[x\\]",
			"> So\n> $$\n> x\n> $$",
		],
		[
			"display delimiters on their own lines in a quote",
			"> \\[\n> a\n> \\]",
			"> $$\n> a\n> $$",
		],
		[
			"inline delimiters nested in display math",
			"\\[\\text{for } \\(n>0\\)\\]",
			"$$\n\\text{for } \\(n>0\\)\n$$",
		],
		[
			"escaped backslash pairs inside math",
			"\\[a \\\\[2pt] b\\]",
			"$$\na \\\\[2pt] b\n$$",
		],
		[
			"several inline formulas",
			"\\(a\\), \\(b\\) and \\(c\\)",
			"$$a$$, $$b$$ and $$c$$",
		],
	])("converts %s", (_, input, expected) => {
		expect(normaliseMathDelimiters(input)).toBe(expected);
	});

	test.each([
		[
			"currency",
			"It costs $5 and $10.",
		],
		[
			"an escaped backslash before a parenthesis",
			"Path \\\\(x\\\\)",
		],
		[
			"empty delimiters",
			"Nothing \\(\\) here",
		],
		[
			"delimiters split by a blank line",
			"\\(a\n\nb\\)",
		],
		[
			"existing dollar math",
			"$$\\text{\\(x\\)}$$",
		],
		[
			"a code span",
			"Use `\\(x\\)` literally",
		],
		[
			"a longer code span holding a backtick",
			"Use ``a ` \\(x\\)`` literally",
		],
		[
			"a fenced block",
			"```latex\n\\(x\\) and \\[y\\]\n```",
		],
		[
			"a tilde fence holding a backtick fence",
			"~~~\n```\n\\(x\\)\n```\n~~~",
		],
		[
			"a fenced block in a list item",
			"- Code:\n  ```\n  \\(x\\)\n  ```",
		],
	])("leaves %s untouched", (_, input) => {
		expect(normaliseMathDelimiters(input)).toBe(input);
	});

	test("converts math around code", () => {
		expect(
			normaliseMathDelimiters(
				"`\\(a\\)` and \\(b\\)\n```\n\\(c\\)\n```\nThen \\(d\\)",
			),
		).toBe("`\\(a\\)` and $$b$$\n```\n\\(c\\)\n```\nThen $$d$$");
	});

	test("keeps currency as text beside converted math", () => {
		expect(normaliseMathDelimiters("$5 and $10, or \\(x\\)")).toBe(
			"$5 and $10, or $$x$$",
		);
	});

	describe("while streaming", () => {
		test.each([
			[
				"an unterminated inline formula",
				"So \\(a^2+b^2",
				"So \\(a^2+b^2",
			],
			[
				"a closer cut after its backslash",
				"So \\(a^2+b^2\\",
				"So \\(a^2+b^2\\",
			],
			[
				"an unterminated display formula after finished math",
				"Done \\(x\\). Next \\[\\sum",
				"Done $$x$$. Next \\[\\sum",
			],
			[
				"an unterminated fence",
				"Text \\(x\\)\n```js\nconst a = '\\(y\\)'",
				"Text $$x$$\n```js\nconst a = '\\(y\\)'",
			],
			[
				"an unclosed code span",
				"Use `\\(x\\) and",
				"Use `\\(x\\) and",
			],
		])("leaves %s as text", (_, input, expected) => {
			expect(normaliseMathDelimiters(input)).toBe(expected);
		});

		test("keeps dollar delimiters paired for every partial reply", () => {
			const reply =
				"Inline \\(a^2+b^2=c^2\\) and `\\(x\\)`.\n\n\\[\n\\sum_{k=0}^{n}\\binom{n}{k}=2^n\n\\]\n\n```\n\\(y\\)\n```\n$5 and $10.";
			for (let length = 0; length <= reply.length; length++) {
				const output = normaliseMathDelimiters(reply.slice(0, length));
				expect(output.split("$$").length % 2).toBe(1);
			}
		});
	});
});

const renderMarkdown = async (markdown: string) => {
	const { container } = render(
		<StreamdownContent>{markdown}</StreamdownContent>,
	);
	await waitFor(() => expect(container.textContent).not.toBe(""));
	return container;
};

describe("StreamdownContent math", () => {
	test("renders parenthesis delimiters inline", async () => {
		const container = await renderMarkdown("So \\(a^2\\) holds.");

		expect(container.querySelector("p .katex")).not.toBeNull();
		expect(container.querySelector(".katex-display")).toBeNull();
	});

	test("renders bracket delimiters as display math between paragraphs", async () => {
		const container = await renderMarkdown("Then \\[x=1\\] holds.");
		const root = container.firstElementChild;

		expect(
			[
				...(root?.children ?? []),
			].map((child) => child.className || child.tagName.toLowerCase()),
		).toEqual([
			"p",
			"katex-display",
			"p",
		]);
	});

	test("renders display math inside its list item", async () => {
		const container = await renderMarkdown("- Sum \\[x\\]\n- Next");

		expect(container.querySelector("li .katex-display")).not.toBeNull();
		expect(container.querySelectorAll("li")).toHaveLength(2);
	});

	test("keeps currency and code as text", async () => {
		const container = await renderMarkdown(
			"It costs $5 and $10, see `\\(x\\)`.",
		);

		expect(container.querySelector(".katex")).toBeNull();
		expect(container.textContent).toBe("It costs $5 and $10, see \\(x\\).");
	});
});
