import { afterEach, describe, expect, mock, test } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { Citations } from "@/lib/ai/citations/chat-sources";

// The real client resolves server configuration at import time.
mock.module("@/lib/orpc/orpc", () => ({
	orpc: {},
}));

const { MessageResponse } = await import("./message");
const { CitationsContext } = await import("./cite");
const { chatLinkSafety, LinkSafetyContext } = await import(
	"@/components/chat/link-confirm"
);
const { MessageSources } = await import(
	"@/components/chat/message/message-sources"
);

const citations: Citations = {
	kgol9ts: {
		kind: "asset",
		assetId: "9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f",
		title: "Refund policy.pdf",
		page: 4,
	},
	w2jpxug: {
		kind: "web",
		url: "https://www.who.int/news-room/fact-sheets/detail/malaria",
		title: "Malaria",
	},
};

const linkSafety = chatLinkSafety({
	docsUrl: "https://docs.example.org",
	appPaths: false,
});

const renderAnswer = (markdown: string) =>
	render(
		<LinkSafetyContext value={linkSafety}>
			<CitationsContext value={citations}>
				<MessageResponse>{markdown}</MessageResponse>
			</CitationsContext>
		</LinkSafetyContext>,
	);

afterEach(cleanup);

describe("CiteComponent", () => {
	test.each([
		"Paid <cite ref=kgol9ts>within 14 days</cite>.",
		'Paid <cite ref="kgol9ts">within 14 days</cite>.',
	])(
		"names the source of a ref from the message's citations: %p",
		async (markdown) => {
			renderAnswer(markdown);

			await waitFor(() =>
				expect(
					screen.getByRole("button", {
						name: "Citation of the asset Refund policy · p. 4",
					}),
				).toBeTruthy(),
			);
			expect(screen.getByText("within 14 days")).toBeTruthy();
		},
	);

	test.each([
		"Paid within 14 days <cite ref=kgol9ts></cite>.",
		"Paid within 14 days<cite ref=kgol9ts>.",
	])(
		"names the source of an empty or unclosed trailing cite: %p",
		async (markdown) => {
			const { container } = renderAnswer(markdown);

			await waitFor(() =>
				expect(
					screen.getByRole("button", {
						name: "Citation of the asset Refund policy · p. 4",
					}),
				).toBeTruthy(),
			);
			expect(container.textContent).toContain("Paid within 14 days");
		},
	);

	test("names a web page by its host, and its card opens the page after asking", async () => {
		renderAnswer("Malaria <cite ref=w2jpxug>is preventable</cite>.");

		fireEvent.click(
			await screen.findByRole("button", {
				name: "Citation of the web page Malaria",
			}),
		);
		expect(await screen.findByText("Malaria")).toBeTruthy();
		// The pill and the card name the host.
		expect(screen.getAllByText("who.int")).toHaveLength(2);
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Open page",
			}),
		);

		const dialog = await screen.findByRole("alertdialog", {
			name: "Open external link?",
		});
		expect(dialog.textContent).toContain(
			"https://www.who.int/news-room/fact-sheets/detail/malaria",
		);

		const opened: unknown[] = [];
		const open = window.open;
		window.open = ((...args: unknown[]) => {
			opened.push(args[0]);
			return null;
		}) as typeof window.open;
		try {
			fireEvent.click(
				screen.getByRole("button", {
					name: "Open link",
				}),
			);
			expect(opened).toEqual([
				"https://www.who.int/news-room/fact-sheets/detail/malaria",
			]);
			await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		} finally {
			window.open = open;
		}
	});

	test.each([
		"javascript:alert(1)",
		"https://user:secret@example.org/page",
	])("shows a web citation of an unsafe URL as plain text: %p", async (url) => {
		const { container } = render(
			<CitationsContext
				value={{
					w2jpxug: {
						kind: "web",
						url,
						title: "Planted",
					},
				}}
			>
				<MessageResponse>
					{"Malaria <cite ref=w2jpxug>is preventable</cite>."}
				</MessageResponse>
			</CitationsContext>,
		);

		await waitFor(() =>
			expect(container.textContent).toContain("is preventable"),
		);
		expect(screen.queryByRole("button")).toBeNull();
	});

	test.each([
		"Paid <cite ref=k000000>soon</cite>.",
		'Paid <cite chunk="kgol9ts">soon</cite>.',
		'Paid <cite assetid="9b2d4c6e-1f3a-4b5c-8d7e-0a1b2c3d4e5f" title="Travel policy" page="2">soon</cite>.',
	])(
		"shows a cite without a resolved ref as plain text: %p",
		async (markdown) => {
			const { container } = renderAnswer(markdown);

			await waitFor(() => expect(container.textContent).toContain("soon"));
			expect(screen.queryByRole("button")).toBeNull();
		},
	);
});

describe("link confirmation", () => {
	test("asks before a Markdown link in an answer opens", async () => {
		renderAnswer("See [the fact sheet](https://example.org/malaria).");

		fireEvent.click(
			await screen.findByRole("button", {
				name: "the fact sheet",
			}),
		);

		expect(
			await screen.findByRole("alertdialog", {
				name: "Open external link?",
			}),
		).toBeTruthy();
		expect(screen.getByText("https://example.org/malaria")).toBeTruthy();
	});

	test("asks before a source in the Sources strip opens", async () => {
		render(
			<LinkSafetyContext value={linkSafety}>
				<MessageSources
					sources={[
						{
							url: "https://example.org/malaria",
							title: "Malaria",
						},
					]}
				/>
			</LinkSafetyContext>,
		);

		fireEvent.click(
			screen.getByRole("button", {
				name: "Malaria",
			}),
		);

		expect(
			await screen.findByRole("alertdialog", {
				name: "Open external link?",
			}),
		).toBeTruthy();
	});

	test("opens a docs link without asking", async () => {
		const opened: unknown[] = [];
		const open = window.open;
		window.open = ((...args: unknown[]) => {
			opened.push(args[0]);
			return null;
		}) as typeof window.open;
		// The trusted check reads the app's origin from the page.
		(
			window as unknown as {
				happyDOM: {
					setURL: (url: string) => void;
				};
			}
		).happyDOM.setURL("https://orcai.example.org/app");
		try {
			renderAnswer(
				"See [Bots](https://docs.example.org/docs/using-orcai/bots).",
			);
			fireEvent.click(
				await screen.findByRole("button", {
					name: "Bots",
				}),
			);

			await waitFor(() =>
				expect(opened).toEqual([
					"https://docs.example.org/docs/using-orcai/bots",
				]),
			);
			expect(screen.queryByRole("alertdialog")).toBeNull();
		} finally {
			window.open = open;
		}
	});
});
