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
