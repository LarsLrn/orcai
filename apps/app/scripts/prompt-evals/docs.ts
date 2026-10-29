import { join } from "node:path";
import type { DocsFetch } from "@/lib/ai/tools/docs/read-docs";
import type { DocsConfig } from "@/lib/effect/services/config";

export const DOCS: DocsConfig = {
	publicOrigin: "https://orcai.example",
	fetchOrigin: "https://docs.local",
};

/** Imported by path, since it belongs to the docs site's project and its aliases. */
const DOCS_FETCH = join(import.meta.dir, "../../../web/scripts/docs-fetch.ts");

/** The docs of this checkout as the docs site serves them, so a docs change counts too. */
export const localDocsFetch: DocsFetch = async (url) => {
	const { docsFetch } = (await import(DOCS_FETCH)) as {
		docsFetch: (url: string) => Promise<Response>;
	};
	return docsFetch(url);
};
