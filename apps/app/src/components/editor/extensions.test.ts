import { describe, expect, spyOn, test } from "bun:test";
import { organizationDescriptionSchema } from "@orcai/schema";
import { Editor } from "@tiptap/core";
import { descriptionExtensions, extensions } from "./extensions";
import { LINK_PROBE } from "./toolbars/link";

describe("editor extensions", () => {
	test("resolve to unique names including StarterKit's bundled extensions", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => undefined);
		const editor = new Editor({
			extensions,
		});
		const names = editor.extensionManager.extensions.map(
			(extension) => extension.name,
		);
		editor.destroy();
		const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
		const warnings = warn.mock.calls.map((args) => String(args[0]));
		warn.mockRestore();

		expect(duplicates).toEqual([]);
		expect(warnings.filter((w) => w.includes("Duplicate"))).toEqual([]);
		expect(names).toContain("link");
		expect(names).toContain("underline");
		expect(names).not.toContain("image");
	});

	test("a description written with every tool is a valid stored description", () => {
		const editor = new Editor({
			extensions: descriptionExtensions,
			content: `
				<h2>About</h2>
				<h3>What we <s>do</s> share</h3>
				<p><strong>Bold</strong>, <em>italic</em>, <u>underlined</u>,<br><a href="https://uni.example">a link</a>, <a href="mailto:lab@uni.example">mail</a>.</p>
				<ul><li><p>One</p></li></ul>
				<ol start="3"><li><p>Two</p></li></ol>
				<blockquote><p>Quote</p></blockquote>
				<hr>
			`,
		});
		const json = editor.getJSON();
		editor.destroy();

		expect(organizationDescriptionSchema.safeParse(json).error).toBeUndefined();
	});

	test("a description editor keeps no link to a refused protocol", () => {
		const editor = new Editor({
			extensions: descriptionExtensions,
			content: '<p><a href="javascript:alert(1)">x</a></p>',
		});
		const json = editor.getJSON();
		editor.destroy();

		expect(organizationDescriptionSchema.safeParse(json).success).toBe(true);
		expect(JSON.stringify(json)).not.toContain("javascript:");
	});

	test.each([
		[
			"block",
			extensions,
		],
		[
			"description",
			descriptionExtensions,
		],
	])("the %s editor offers a link on selected text", (_, set) => {
		const editor = new Editor({
			extensions: set,
			content: "<p>Write to the lab</p>",
		});
		editor.commands.setTextSelection({
			from: 10,
			to: 17,
		});
		const offered = editor
			.can()
			.chain()
			.setLink({
				href: LINK_PROBE,
			})
			.run();
		editor.commands.setLink({
			href: "mailto:lab@uni.example",
		});
		const json = editor.getJSON();
		editor.destroy();

		expect(offered).toBe(true);
		expect(JSON.stringify(json)).toContain("mailto:lab@uni.example");
	});
});
