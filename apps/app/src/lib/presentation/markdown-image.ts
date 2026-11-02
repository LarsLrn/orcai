import { createIsomorphicFn } from "@tanstack/react-start";
import { loadAppConfigSync } from "@/lib/effect/services/config";

/** The app's public origin, the same during SSR and in the browser. */
export const appOrigin = createIsomorphicFn()
	.server(() => new URL(loadAppConfigSync().auth.url).origin)
	.client(() => window.location.origin);

/**
 * Markdown from models and documents loads only images the app serves, so a
 * reply cannot send data out through an image address. An image on another
 * site becomes a link, anything else its alt text.
 */
export const markdownImage = (
	src: unknown,
	origin: string,
):
	| {
			load: string;
	  }
	| {
			link: string;
	  }
	| undefined => {
	const url = typeof src === "string" ? URL.parse(src, origin) : null;
	if (url?.protocol !== "https:" && url?.protocol !== "http:") return;
	return url.origin === origin
		? {
				load: url.href,
			}
		: {
				link: url.href,
			};
};

const entity = /(?:&#?|#)(\w+);/g;

/**
 * Numeric entities decoded, as Mermaid and the HTML parser do. A named entity
 * other than a `#rgb;` colour leaves nothing to check.
 */
const decodedText = (source: string) => {
	let hidden = false;
	const decoded = source.replace(entity, (match, name: string) => {
		const code = /^\d+$/.test(name)
			? Number(name)
			: /^x[0-9a-f]+$/i.test(name)
				? Number.parseInt(name.slice(1), 16)
				: undefined;
		if (code !== undefined && code <= 0x10ffff) {
			return String.fromCodePoint(code);
		}
		if (!/^#[0-9a-f]{3,8};$/i.test(match)) hidden = true;
		return match;
	});
	return hidden ? undefined : decoded;
};

const safeTags = "br|b|i|em|strong|u|s|sub|sup|small|code|span|p";
const loading = new RegExp(
	[
		// Image nodes in shape data, and image tags.
		"\\bimg\\b",
		// Tags other than text formatting.
		`<\\s*/?\\s*(?!(?:${safeTags})\\b)[a-z]`,
		"\\bhref\\b",
		"\\b(?:src|srcset|poster|background|data)\\s*=",
		"\\b(?:url|image-set)\\s*\\(",
		"@import",
		// A backslash is a slash to the URL parser and an escape to YAML.
		"\\\\",
	].join("|"),
	"i",
);

/**
 * Mermaid loads image nodes while it renders, before anything is sanitised,
 * so a diagram renders only when nothing in it could load content: no image,
 * tag, link attribute or stylesheet address, and no `//`, which the URL parser
 * still finds across tabs and line breaks.
 */
export const diagramLoadsNothing = (source: string) => {
	const text = decodedText(source);
	return (
		text !== undefined &&
		!loading.test(text.replace(/<<\w+>>/g, "")) &&
		!text.replace(/[\t\n\r]/g, "").includes("//")
	);
};
