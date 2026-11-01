import { docsMarkdownPath } from "@orcai/core";

export interface TrustedLinks {
	appOrigin: string;
	docsUrl: string | undefined;
	/** App paths open without asking too, as the Assistant links them to answer. */
	appPaths: boolean;
}

/** Docs pages, and app paths where `appPaths` allows them, open without asking. */
export const isTrustedLink = (
	url: string,
	{ appOrigin, docsUrl, appPaths }: TrustedLinks,
) => {
	const target = URL.parse(url, appOrigin);

	if (!target || target.username || target.password) {
		return false;
	}

	if (
		appPaths &&
		target.origin === appOrigin &&
		(target.pathname === "/app" || target.pathname.startsWith("/app/"))
	) {
		return true;
	}

	const docs = docsUrl ? URL.parse(docsUrl) : null;

	if (!docs || target.origin !== docs.origin) {
		return false;
	}

	const base = docs.pathname.replace(/\/$/, "");

	return (
		target.pathname.startsWith(`${base}/`) &&
		docsMarkdownPath(target.pathname.slice(base.length)) !== undefined
	);
};
