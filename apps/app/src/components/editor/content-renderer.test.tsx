import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentRenderer } from "./content-renderer";

describe("ContentRenderer", () => {
	test("a stored cookie-enabled embed renders without cookies", () => {
		const html = renderToStaticMarkup(
			<ContentRenderer
				content={{
					type: "doc",
					content: [
						{
							type: "youtube",
							attrs: {
								src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
								width: 640,
								height: 480,
							},
						},
					],
				}}
			/>,
		);

		expect(html).toContain(
			'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"',
		);
		expect(html).not.toContain("width=");
	});

	test("a malformed stored embed renders without a source", () => {
		const html = renderToStaticMarkup(
			<ContentRenderer
				content={{
					type: "doc",
					content: [
						{
							type: "youtube",
							attrs: {
								src: 42,
								start: "soon",
							},
						},
					],
				}}
			/>,
		);

		expect(html).toContain("<iframe");
		expect(html).not.toContain("src=");
	});
});
