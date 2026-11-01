import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { m } from "@/paraglide/messages";

let docsUrl: string | undefined;

mock.module("@/hooks/use-public-config", () => ({
	usePublicConfig: () => ({
		docsUrl,
	}),
}));

const { BehaviourDocsLink } = await import(
	"@/components/authoring/behaviour-docs-link"
);

afterEach(cleanup);

describe("BehaviourDocsLink", () => {
	test("opens the behaviours page of the docs in a new tab", () => {
		docsUrl = "https://docs.example.org/";
		render(<BehaviourDocsLink />);

		const link = screen.getByRole("link", {
			name: m.authoring_behaviour_docs_link(
				{},
				{
					locale: "en",
				},
			),
		});

		expect(link.getAttribute("href")).toBe(
			"https://docs.example.org/docs/using-orcai/behaviours",
		);
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.getAttribute("rel")).toBe("noopener noreferrer");
	});

	test("renders nothing without a docs URL", () => {
		docsUrl = undefined;
		const { container } = render(<BehaviourDocsLink />);

		expect(container.innerHTML).toBe("");
	});
});

describe("the behaviour example", () => {
	test("is written in the language of the interface", () => {
		expect(
			m.authoring_behaviour_example(
				{},
				{
					locale: "en",
				},
			),
		).toStartWith("You are the course assistant");
		expect(
			m.authoring_behaviour_example(
				{},
				{
					locale: "de",
				},
			),
		).toStartWith("Sie sind der Kursassistent");
	});
});
