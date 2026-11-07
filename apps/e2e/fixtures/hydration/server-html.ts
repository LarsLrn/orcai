import type {
	BrowserContext,
	BrowserContextOptions,
	Page,
} from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * The page at `path` as the server sends it to `page`'s session, read to its
 * end and shown with scripts off, so only server-rendered elements exist.
 * Streamed regions stay in hidden containers: locate with `includeHidden`
 * and assert `toBeAttached`.
 */
export const serverHtml = async (
	page: Page,
	newContext: (options?: BrowserContextOptions) => Promise<BrowserContext>,
	path: string,
): Promise<Page> => {
	const response = await page.request.get(path);
	expect(response.status(), `${path} renders`).toBe(200);
	const html = await response.text();

	const context = await newContext({
		javaScriptEnabled: false,
	});
	const view = await context.newPage();
	await view.setContent(html);

	return view;
};
