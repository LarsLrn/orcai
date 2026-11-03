import { afterEach, describe, expect, test } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { m } from "@/paraglide/messages";
import { shortcutLabel } from "./controls";
import { extensions } from "./extensions";
import { DefaultBubbleMenu } from "./menus/default-bubble-menu";
import { EditorToolbar } from "./toolbars/editor-toolbar";

let editor: Editor | undefined;

afterEach(() => {
	cleanup();
	editor?.destroy();
});

/** A block editor in the page with "Write to the lab" selected. */
const selectedEditor = (content = "<p>Write to the lab</p>") => {
	const element = document.createElement("div");
	document.body.append(element);
	editor = new Editor({
		element,
		extensions,
		content,
	});
	editor.commands.setTextSelection({
		from: 1,
		to: 17,
	});
	return editor;
};

/** Lets the scroll area and popovers finish measuring. */
const settle = () => act(() => Promise.resolve());

const surfaces = [
	{
		name: "toolbar",
		render: async (editor: Editor) => {
			render(<EditorToolbar editor={editor} />);
			await settle();
		},
		alignmentTrigger: () => m.editor_control_align_left(),
		alignmentRole: "menuitem",
		quote: async () => {
			fireEvent.click(button(m.editor_control_blockquote()));
		},
	},
	{
		name: "bubble menu",
		render: async (editor: Editor) => {
			render(<DefaultBubbleMenu editor={editor} />);
			act(() => {
				editor.commands.focus();
			});
			await settle();
		},
		alignmentTrigger: () => m.editor_toolbar_alignment_tooltip(),
		alignmentRole: "button",
		quote: async () => {
			fireEvent.click(
				button(
					m.editor_control_heading({
						level: 1,
					}),
				),
			);
			await settle();
			fireEvent.click(button(m.editor_control_blockquote()));
		},
	},
] as const;

const button = (name: string) =>
	screen.getByRole("button", {
		name,
	});

describe.each(surfaces)("the $name", (surface) => {
	test.each([
		[
			"bold",
			m.editor_control_bold,
		],
		[
			"italic",
			m.editor_control_italic,
		],
		[
			"underline",
			m.editor_control_underline,
		],
		[
			"strike",
			m.editor_control_strike,
		],
		[
			"code",
			m.editor_control_code,
		],
	])("toggles %s on the selection", async (mark, label) => {
		const editor = selectedEditor();
		await surface.render(editor);

		fireEvent.click(button(label()));
		expect(editor.isActive(mark)).toBe(true);
		expect(button(label()).getAttribute("aria-pressed")).toBe("true");

		fireEvent.click(button(label()));
		expect(editor.isActive(mark)).toBe(false);
	});

	test.each([
		[
			"example.com",
			"https://example.com/",
		],
		[
			"lab@uni.example",
			"mailto:lab@uni.example",
		],
		[
			" https://uni.example/lab ",
			"https://uni.example/lab",
		],
		[
			"/docs",
			"/docs",
		],
		[
			"#section",
			"#section",
		],
		[
			"../guide",
			"../guide",
		],
		[
			"//uni.example",
			"https://uni.example/",
		],
	])("links %p as %p", async (typed, href) => {
		const editor = selectedEditor();
		await surface.render(editor);

		fireEvent.click(button(m.editor_control_link()));
		await settle();
		const input = screen.getByLabelText(m.editor_control_link(), {
			selector: "input",
		});
		fireEvent.change(input, {
			target: {
				value: typed,
			},
		});
		fireEvent.submit(input);

		expect(editor.getAttributes("link").href).toBe(href);
	});

	test.each([
		"the lab",
		"https://%zz",
		"ftp://example.com",
		"/\\evil.example",
		"\\\\evil.example",
	])("keeps no link for %p", async (typed) => {
		const editor = selectedEditor();
		await surface.render(editor);

		fireEvent.click(button(m.editor_control_link()));
		await settle();
		const input = screen.getByLabelText(m.editor_control_link(), {
			selector: "input",
		});
		fireEvent.change(input, {
			target: {
				value: typed,
			},
		});
		fireEvent.submit(input);

		expect(editor.isActive("link")).toBe(false);
	});

	test("offers no mark or link on a selected formula", async () => {
		const editor = selectedEditor(
			'<p>Mass <span data-type="math" latex="E=mc^2"></span> energy</p>',
		);
		act(() => {
			editor.commands.setTextSelection({
				from: 6,
				to: 7,
			});
		});
		await surface.render(editor);

		for (const label of [
			m.editor_control_bold(),
			m.editor_control_code(),
			m.editor_control_link(),
		]) {
			expect(button(label).hasAttribute("disabled")).toBe(true);
		}
	});

	test("quotes a heading as a paragraph", async () => {
		const editor = selectedEditor("<h1>Write to the lab</h1>");
		await surface.render(editor);

		await surface.quote();

		expect(editor.getJSON().content?.[0]).toMatchObject({
			type: "blockquote",
			content: [
				{
					type: "paragraph",
				},
			],
		});
	});

	test("aligns the selected paragraph", async () => {
		const editor = selectedEditor();
		await surface.render(editor);

		fireEvent.click(button(surface.alignmentTrigger()));
		await settle();
		fireEvent.click(
			screen.getByRole(surface.alignmentRole, {
				name: m.editor_control_align_right(),
			}),
		);

		expect(
			editor.isActive({
				textAlign: "right",
			}),
		).toBe(true);
	});
});

describe("shortcutLabel", () => {
	test.each([
		[
			"MacIntel",
			"Mod-b",
			"⌘B",
		],
		[
			"MacIntel",
			"Mod-Shift-s",
			"⇧⌘S",
		],
		[
			"Win32",
			"Mod-b",
			"Ctrl+B",
		],
		[
			"Linux x86_64",
			"Mod-Shift-s",
			"Ctrl+Shift+S",
		],
	])("on %s writes %s as %s", (platform, shortcut, label) => {
		Object.defineProperty(navigator, "platform", {
			value: platform,
			configurable: true,
		});
		expect(shortcutLabel(shortcut)).toBe(label);
		Reflect.deleteProperty(navigator, "platform");
	});
});
