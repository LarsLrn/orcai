/** Origins besides the app's own that this deployment sends browsers to. */
export interface PolicyOrigins {
	/** Object storage, which presigned uploads and downloads address. */
	readonly storage: string;
	readonly analytics?: string;
}

export const createNonce = () =>
	Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");

const YOUTUBE = "https://www.youtube-nocookie.com";

/**
 * Inline styles stay allowed: KaTeX, Mermaid and the UI primitives write style
 * attributes. Without a nonce and origins, the policy suits a response that
 * loads nothing itself. Development adds the Vite client's WebSocket.
 */
export const contentSecurityPolicy = ({
	nonce,
	origins,
	development = false,
}: {
	nonce?: string;
	origins?: PolicyOrigins;
	development?: boolean;
} = {}) => {
	const external = (...sources: (string | false | undefined)[]) =>
		sources.filter((source): source is string => Boolean(source));
	const storage = external(origins?.storage);
	const analytics = external(origins?.analytics);
	const directives = {
		"default-src": [
			"'self'",
		],
		"script-src": [
			"'self'",
			...external(nonce && `'nonce-${nonce}'`),
			...analytics,
		],
		"style-src": [
			"'self'",
			"'unsafe-inline'",
		],
		"font-src": [
			"'self'",
			"data:",
		],
		"img-src": [
			"'self'",
			"data:",
			"blob:",
			...storage,
		],
		"media-src": [
			"'self'",
			"blob:",
			...storage,
		],
		"connect-src": [
			"'self'",
			...storage,
			...analytics,
			...external(development && "ws:"),
		],
		"frame-src": [
			"'self'",
			...storage,
			YOUTUBE,
		],
		"object-src": [
			"'none'",
		],
		"base-uri": [
			"'self'",
		],
		"form-action": [
			"'self'",
		],
		"frame-ancestors": [
			"'self'",
		],
	};

	return Object.entries(directives)
		.map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
		.join("; ");
};

export const CONTENT_SECURITY_POLICY = "Content-Security-Policy";

/** Copies the response, since a redirect's headers are immutable. */
export const withContentSecurityPolicy = (
	response: Response,
	policy: string,
) => {
	const secured = new Response(response.body, response);
	secured.headers.set(CONTENT_SECURITY_POLICY, policy);
	return secured;
};
