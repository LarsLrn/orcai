import type { ExtractionConfig } from "@kreuzberg/node";

/**
 * Local compatibility types for Kreuzberg runtime options that exist in the
 * current native package but are missing from the published npm declarations.
 *
 * TODO: Remove this file once @kreuzberg/node ships updated types.
 */

export interface ContentFilterConfig {
	/** Include header text in extracted content. Default: true. */
	includeHeaders?: boolean;
	/** Include footer text in extracted content. Default: true. */
	includeFooters?: boolean;
	/** Strip repeating text blocks across pages. Default: false. */
	stripRepeatingText?: boolean;
	/** Include watermark text in extracted content. Default: false. */
	includeWatermarks?: boolean;
}

export interface ExpandedChunkingConfig
	extends NonNullable<ExtractionConfig["chunking"]> {
	/**
	 * Type of chunker: "text" (default), "markdown", or "yaml".
	 * Default: null (text)
	 */
	chunkerType?: "text" | "markdown" | "yaml" | null;
	/**
	 * When true, prepends the heading hierarchy path to each chunk's content.
	 * Most useful with chunkerType: "markdown".
	 * Default: null (false)
	 */
	prependHeadingContext?: boolean | null;
}

export type ExpandedExtractionConfig = Omit<ExtractionConfig, "chunking"> & {
	chunking?: ExpandedChunkingConfig;
	contentFilter?: ContentFilterConfig;
};
