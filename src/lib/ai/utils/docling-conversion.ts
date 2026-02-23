import {
	type SerializedDocument,
	serializeDoclingDocument,
} from "@/lib/ai/docling-serialize";
import type { SaiaDoclingData } from "@/types/docling";

export type DoclingSerializationOptions = {
	mergePages?: boolean;
	keepHeader?: boolean;
	keepFooter?: boolean;
	keepImageRefs?: boolean;
	keepMarkdownTables?: boolean;
};

export const serializeDoclingPayload = (
	payload: SaiaDoclingData,
	options: DoclingSerializationOptions,
): SerializedDocument[] =>
	serializeDoclingDocument(payload.json_data, options) ?? [];

export const serializeDoclingPayloadToMarkdown = (
	payload: SaiaDoclingData,
	options: DoclingSerializationOptions,
) =>
	serializeDoclingPayload(payload, options)
		.map((entry) => entry.markdown)
		.join("\n\n")
		.trim();
