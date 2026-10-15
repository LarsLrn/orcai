import { describe, expect, spyOn, test } from "bun:test";
import { Editor } from "@tiptap/core";
import { extensions } from "./extensions";

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
		expect(names).toContain("image");
	});
});
