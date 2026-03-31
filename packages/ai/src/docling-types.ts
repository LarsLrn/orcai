import type { DoclingDocument } from "@docling/docling-core";

export interface DoclingData {
	document: {
		filename: string;
		md_content: string | null;
		json_content: string | null;
		html_content: string | null;
		text_content: string | null;
		doctags_content: string | null;
	};
	status: string;
	errors: [];
	processing_time: number;
	timings: object;
}

export interface SaiaDoclingData {
	filename: string;
	images: {
		type: string;
		filename: string;
		image: string;
	}[];
	json_data: DoclingDocument;
}
