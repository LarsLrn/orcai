import type { CatalogueKind } from "@orcai/schema";
import { notFound } from "@tanstack/react-router";
import { KIND_SLUGS } from "@/lib/navigation/kind-slugs";

/** A `$kind` segment over the given kinds: the slug in the path, the kind in params; any other slug is not found. */
export const kindParams = <K extends CatalogueKind>(kinds: readonly K[]) => ({
	parse: ({ kind: slug }: { kind: string }) => {
		const kind = kinds.find((candidate) => KIND_SLUGS[candidate] === slug);
		if (!kind) throw notFound();
		return {
			kind,
		};
	},
	stringify: ({ kind }: { kind: K }) => ({
		kind: KIND_SLUGS[kind],
	}),
});
