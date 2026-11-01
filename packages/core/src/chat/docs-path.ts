const DOCS_PATH = /^\/docs(\/[a-z0-9]+(-[a-z0-9]+)*)*$/;

/** The page path without one trailing `/` or `.md`, and the docs site path serving its Markdown. */
export const docsMarkdownPath = (path: string) => {
	const normalised = path.replace(/(\/|\.md)$/, "");

	if (!DOCS_PATH.test(normalised)) {
		return undefined;
	}

	return {
		path: normalised,
		fetchPath: normalised === "/docs" ? "/docs/index.md" : `${normalised}.md`,
	};
};

/** A docs page's URL on the docs site; none for a path that is not one as `docsMarkdownPath` writes it. */
export const docsPageUrl = (docsUrl: string, path: string) =>
	docsMarkdownPath(path)?.path === path
		? `${docsUrl.replace(/\/$/, "")}${path}`
		: undefined;
