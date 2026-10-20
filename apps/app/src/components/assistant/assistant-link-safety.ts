import type { LinkSafetyConfig } from "streamdown";

/** App paths and docs pages; the assistant links these to answer, so they skip the confirmation. */
export const isTrustedAssistantLink = (
	url: string,
	{
		appOrigin,
		docsUrl,
	}: {
		appOrigin: string;
		docsUrl: string | undefined;
	},
) => {
	const target = URL.parse(url, appOrigin);

	if (!target) {
		return false;
	}

	if (
		target.origin === appOrigin &&
		(target.pathname === "/app" || target.pathname.startsWith("/app/"))
	) {
		return true;
	}

	const docs = docsUrl ? URL.parse(docsUrl) : null;

	if (!docs || target.origin !== docs.origin) {
		return false;
	}

	const docsPath = docs.pathname.replace(/\/$/, "");

	return (
		target.pathname === docsPath || target.pathname.startsWith(`${docsPath}/`)
	);
};

/** Trusted links open in a new tab at once, so the conversation stays open; others still ask. */
export const assistantLinkSafety = (
	docsUrl: string | undefined,
): LinkSafetyConfig => ({
	enabled: true,
	onLinkCheck: (url) =>
		isTrustedAssistantLink(url, {
			appOrigin: window.location.origin,
			docsUrl,
		}),
});
