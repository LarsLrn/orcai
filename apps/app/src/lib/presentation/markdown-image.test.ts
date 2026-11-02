import { describe, expect, test } from "bun:test";
import { diagramLoadsNothing, markdownImage } from "./markdown-image";

const origin = "https://orcai.example";

describe("markdownImage", () => {
	test("loads images on the app, by path or by its origin", () => {
		expect(markdownImage("/api/images/logo.png", origin)).toEqual({
			load: "https://orcai.example/api/images/logo.png",
		});
		expect(
			markdownImage("https://orcai.example/api/images/logo.png", origin),
		).toEqual({
			load: "https://orcai.example/api/images/logo.png",
		});
	});

	test("links images on other sites, protocol-relative ones included", () => {
		for (const [src, link] of [
			[
				"https://attacker.example/p.png?d=secret",
				"https://attacker.example/p.png?d=secret",
			],
			[
				"//attacker.example/p.png",
				"https://attacker.example/p.png",
			],
			[
				"/\\attacker.example/p.png",
				"https://attacker.example/p.png",
			],
			[
				"http://orcai.example/p.png",
				"http://orcai.example/p.png",
			],
		]) {
			expect(markdownImage(src, origin)).toEqual({
				link,
			});
		}
	});

	test("resolves an address the way the browser does", () => {
		for (const [src, link] of [
			[
				"/\\storage.example/attacker-bucket/p.png?d=notes",
				"https://storage.example/attacker-bucket/p.png?d=notes",
			],
			[
				"\\\\storage.example/p.png",
				"https://storage.example/p.png",
			],
			[
				"\\/storage.example/p.png",
				"https://storage.example/p.png",
			],
			[
				"ht\ttps://storage.example/p.png",
				"https://storage.example/p.png",
			],
			[
				"https:/\n/storage.example/p.png",
				"https://storage.example/p.png",
			],
			[
				"\u0001 https://storage.example/p.png",
				"https://storage.example/p.png",
			],
		]) {
			expect(markdownImage(src, origin)).toEqual({
				link,
			});
		}
	});

	test("shows neither for other schemes", () => {
		for (const src of [
			"data:image/png;base64,AAAA",
			"javascript:alert(1)",
			undefined,
		]) {
			expect(markdownImage(src, origin)).toBeUndefined();
		}
	});
});

describe("diagramLoadsNothing", () => {
	test("renders plain, styled and annotated diagrams", () => {
		for (const source of [
			"graph TD\n  A[Start] -->|yes| B(End<br/>now)\n  B --> C[<b>bold</b> and <i>slanted</i>]",
			"graph TD\n  A --> B\n  classDef default fill:#f9f,stroke:#333;\n  style B fill:#bbf,stroke:#f66,stroke-width:2px;\n  linkStyle 0 stroke:#ff3",
			"classDiagram\n  class Shape {\n    <<interface>>\n    +area() double\n  }",
			'graph TD\n  A["Price #35;1, #8364;5"]',
		]) {
			expect(diagramLoadsNothing(source)).toBe(true);
		}
	});

	test("refuses anything that could load content, wherever it points", () => {
		for (const source of [
			'graph TD\n  A@{ img: "/api/images/logo.png", label: "Notes" }',
			'graph TD\n  A@{ img: "https://orcai.example(foo@storage.example/attacker-bucket/p.png?d=notes", label: "Notes" }',
			'graph TD\n  A@{ label: "Notes",\n  img: "x.png" }',
			"graph TD\n  A[\"<img src='/p.png'>\"]",
			"graph TD\n  A[\"<image href='/p.png'/>\"]",
			"graph TD\n  A[\"<span style='background:url(/p.png)'>x</span>\"]",
			"graph TD\n  classDef x background-image:url(/p.png)",
			"%%{init: {'themeCSS': '@import \"/p.css\";'}}%%\ngraph TD\n  A",
			'graph TD\n  A\n  click A href "https://attacker.example"',
			"graph TD\n  A[see //attacker.example]",
			"graph TD\n  A[see /\t/attacker.example]",
			"graph TD\n  A[see /\n/attacker.example]",
			'graph TD\n  A@{ img: "/\\storage.example/p.png" }',
			'graph TD\n  A@{ i\\x6dg: "p.png" }',
			'graph TD\n  A@{ #105;mg: "p.png" }',
			'graph TD\n  A["#60;video poster=p.png#62;"]',
			'graph TD\n  A["&lt;img src=p.png&gt;"]',
		]) {
			expect(diagramLoadsNothing(source)).toBe(false);
		}
	});
});
