import { describe, expect, test } from "bun:test";
import { Editor } from "@tiptap/core";
import { extensions } from "../extensions";
import { youtubeEmbedUrl } from "./youtube";

const embed = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";

describe("youtubeEmbedUrl", () => {
	test.each([
		"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		"https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
		"youtube.com/watch?v=dQw4w9WgXcQ",
		"https://youtu.be/dQw4w9WgXcQ",
		"https://youtu.be/dQw4w9WgXcQ?si=abc",
		"https://m.youtube.com/watch?v=dQw4w9WgXcQ",
		"https://music.youtube.com/watch?v=dQw4w9WgXcQ",
		"https://www.youtube.com/embed/dQw4w9WgXcQ",
		"https://www.youtube.com/shorts/dQw4w9WgXcQ",
		"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
		" https://youtube-nocookie.com/embed/dQw4w9WgXcQ?start=5 ",
	])("%s embeds without cookies", (url) => {
		expect(youtubeEmbedUrl(url)).toBe(embed);
	});

	test("a start offset carries over", () => {
		expect(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ", 42)).toBe(
			`${embed}?start=42`,
		);
	});

	test.each([
		"https://youtube.com/not-a-video",
		"https://www.youtube.com/watch?v=abc",
		"https://www.youtube.com/watch",
		"https://www.youtube.com/embed/",
		"https://youtube-nocookie.com/watch?v=dQw4w9WgXcQ",
		"https://vimeo.com/123456",
		"https://notyoutube.com/watch?v=dQw4w9WgXcQ",
		"not a link",
		"",
		null,
	])("%p names no video", (url) => {
		expect(youtubeEmbedUrl(url)).toBeNull();
	});
});

describe("TiptapYoutube", () => {
	test("a pasted watch link stores the nocookie embed", () => {
		const editor = new Editor({
			extensions,
		});
		editor.view.pasteText("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
		const json = editor.getJSON();
		editor.destroy();

		expect(
			json.content?.find((node) => node.type === "youtube")?.attrs?.src,
		).toBe(embed);
	});

	test("a pasted video link among other lines still embeds", () => {
		const editor = new Editor({
			extensions,
		});
		editor.view.pasteHTML("<p>Watch</p><p>https://youtu.be/dQw4w9WgXcQ</p>");
		const json = editor.getJSON();
		editor.destroy();

		expect(
			json.content?.find((node) => node.type === "youtube")?.attrs?.src,
		).toBe(embed);
	});

	test("inserting stores the nocookie embed and refuses a link without a video", () => {
		const editor = new Editor({
			extensions,
		});
		const refused = editor.commands.setYoutubeVideo({
			src: "https://youtube.com/not-a-video",
		});
		editor.commands.setYoutubeVideo({
			src: "https://youtu.be/dQw4w9WgXcQ",
		});
		const json = editor.getJSON();
		const html = editor.getHTML();
		editor.destroy();

		expect(refused).toBe(false);
		expect(
			json.content?.find((node) => node.type === "youtube")?.attrs?.src,
		).toBe(embed);
		expect(html).toContain(`src="${embed}"`);
	});

	test("an insert after a video keeps the video", () => {
		const editor = new Editor({
			extensions,
		});
		editor.commands.setYoutubeVideo({
			src: "https://youtu.be/dQw4w9WgXcQ",
		});
		editor.commands.insertTable({
			rows: 3,
			cols: 3,
			withHeaderRow: true,
		});
		const types = editor.getJSON().content?.map((node) => node.type);
		editor.destroy();

		expect(types).toEqual([
			"youtube",
			"table",
			"paragraph",
		]);
	});
});
