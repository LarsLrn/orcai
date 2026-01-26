import type {
	CodeItem,
	DoclingDocument,
	Formatting,
	FormulaItem,
	GroupItem1,
	ImageRef,
	InlineGroup,
	ListItem,
	OrderedList,
	PictureItem,
	ProvenanceItem,
	RefItem,
	SectionHeaderItem,
	TableCell,
	TableItem,
	TextItem,
	TitleItem,
	UnorderedList,
} from "@docling/docling-core";
import { logger } from "@/lib/observability/logger";

// Define base and specific types for the discriminated union
interface SectionContentBase {
	markdown: string;
	page: number;
}

// Specific type for PictureItem labels (e.g., 'picture', 'chart')
interface PictureChartTypeSectionContent extends SectionContentBase {
	label: PictureItem["label"]; // This will be 'picture' | 'chart'
	index: number; // Required
	image: ImageRef | undefined | null; // Required
}

// Specific type for TableItem label (e.g., 'table')
interface TableTypeSectionContent extends SectionContentBase {
	label: TableItem["label"];
	index: number; // Required
	image: ImageRef | undefined | null;
}

// Specific type for all other item labels
type ContentItems =
	| TextItem
	| TitleItem
	| SectionHeaderItem
	| ListItem
	| CodeItem
	| FormulaItem
	| OrderedList
	| UnorderedList
	| InlineGroup
	| GroupItem1
	| TableItem
	| PictureItem;

interface OtherTypeSectionContent extends SectionContentBase {
	label: Exclude<ContentItems, PictureItem | TableItem>["label"];
}

// The new discriminated union type for SectionContent
export type SectionContent =
	| PictureChartTypeSectionContent
	| TableTypeSectionContent
	| OtherTypeSectionContent;

interface SerializationOptions {
	mergePages?: boolean;
	keepHeader?: boolean;
	keepFooter?: boolean;
	keepImageRefs?: boolean;
	keepMarkdownTables?: boolean;
}

export interface SerializedDocument {
	page: number;
	markdown: string;
	images: (
		| (ImageRef & {
				label: TableItem["label"] | PictureItem["label"];
				index: number;
		  })
		| undefined
		| null
	)[]; // Optional array of image references
}

/**
 * Serializes a DoclingDocument into an array of markdown strings, optionally split by page.
 *
 * @param doclingDocument The DoclingDocument to serialize.
 * @param options Serialization options.
 * @param options.mergePages If true, all content will be merged into a single page (page 0). Defaults to false.
 * @param options.keepHeader If true, page headers will be included in the markdown. Defaults to false.
 * @param options.keepFooter If true, page footers will be included in the markdown. Defaults to false.
 * @param options.keepImageRefs If true, image references (self_ref) will be included. Defaults to true.
 * @returns An array of SerializedDocument objects, each containing the markdown content and page number, or undefined if no references are found.
 */
export const serializeDoclingDocument = (
	doclingDocument: DoclingDocument,
	options: SerializationOptions,
): SerializedDocument[] | undefined => {
	const {
		mergePages = false,
		keepFooter = false,
		keepHeader = false,
		keepImageRefs = true,
		keepMarkdownTables = true,
	} = options;

	const serializedDocument: SectionContent[] = [];

	const refs = doclingDocument.body?.children;

	if (!refs) {
		logger.error("No references found in the document.");
		return;
	}

	for (const ref of refs) {
		const section = getSection(ref, doclingDocument);

		if (!section) return;

		const content = extractContent(section, doclingDocument, {
			keepFooter,
			keepHeader,
			keepImageRefs,
			keepMarkdownTables,
		});
		if (!content) continue;

		serializedDocument.push(content);
	}

	const mergedDocument: { [page: number]: SerializedDocument } = {};

	for (const item of serializedDocument) {
		const page = mergePages ? 0 : item.page;

		if (!mergedDocument[page]) {
			mergedDocument[page] = { markdown: "", page, images: [] };
		}
		const updatedMarkdown = mergedDocument[page].markdown + item.markdown;

		const test =
			item.label === "picture" ||
			item.label === "chart" ||
			item.label === "table"
				? item.image
				: undefined;

		const images: (ImageRef & {
			label: "picture" | "chart" | "table";
			index: number;
		})[] = [];

		if (
			test &&
			(item.label === "picture" ||
				item.label === "chart" ||
				item.label === "table")
		) {
			images.push({ label: item.label, index: item.index, ...test });
		}

		mergedDocument[page] = {
			page,
			markdown: updatedMarkdown,
			images: mergedDocument[page].images.concat(images),
		};
	}

	const newSerializedDocument = Object.entries(mergedDocument).map(
		([page, doc]) => ({
			page: Number(page),
			markdown: doc.markdown,
			images: doc.images,
		}),
	);

	return newSerializedDocument;
};

/**
 * Extracts content from a Docling item and converts it to markdown.
 *
 * @param content The Docling item to extract content from.
 * @param doclingDocument The parent DoclingDocument.
 * @param options Options for content extraction (excluding mergePages).
 * @returns A SectionContent object with markdown and page number, or undefined if the content type is not handled or options prevent it.
 */
const extractContent = (
	content:
		| TextItem
		| PictureItem
		| TitleItem
		| SectionHeaderItem
		| ListItem
		| CodeItem
		| FormulaItem
		| OrderedList
		| UnorderedList
		| InlineGroup
		| GroupItem1
		| TableItem,
	doclingDocument: DoclingDocument,
	options: Omit<SerializationOptions, "mergePages">,
): SectionContent | undefined => {
	switch (content.label) {
		case "caption": {
			return {
				markdown: `## ${content.text}\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		}
		case "chapter":
		case "ordered_list":
		case "list":
		case "inline":
		case "section":
		case "slide":
		case "comment_section":
		case "key_value_area":
		case "form_area":
		case "sheet": {
			if (!content.children) break;

			for (const child of content.children) {
				const section = getSection(child, doclingDocument);
				if (!section) return;

				return extractContent(section, doclingDocument, options);
			}
			break;
		}
		case "list_item":
			return {
				markdown: `${content.marker} ${formatText(content.formatting, content.text)} \n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "code":
			return {
				markdown: `\`\`\`${content.text}\`\`\`\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "title":
			return {
				markdown: `# ${formatText(content.formatting, content.text)}\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "text":
		case "paragraph":
			return {
				markdown: `${formatText(content.formatting, content.text)}\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "checkbox_selected":
			return {
				markdown: `[x] ${formatText(content.formatting, content.text)} `,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "checkbox_unselected":
			return {
				markdown: `[ ] ${formatText(content.formatting, content.text)} `,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "footnote":
			return {
				markdown: `[^${formatText(content.formatting, content.text)}]\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "formula":
			return {
				markdown: `$$${content.text}$$\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "section_header": {
			const level = content.level || 2; // Default to level 2 if not provided
			return {
				markdown: `#${"#".repeat(level)} ${formatText(content.formatting, content.text)}\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		}
		case "page_footer": {
			if (!options.keepFooter) return;
			return {
				markdown: `---\n${formatText(content.formatting, content.text)}\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		}
		case "page_header": {
			if (!options.keepHeader) return;
			return {
				markdown: `---\n${formatText(content.formatting, content.text)}\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		}
		case "reference":
			return {
				markdown: `[^${formatText(content.formatting, content.text)}]\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "picture":
		case "chart": {
			if (!options.keepImageRefs) return;
			const { index } = splitRef(content.self_ref);

			return {
				markdown: `<${content.label}-${index + 1}>\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
				index: splitRef(content.self_ref).index + 1, // 1-based index
				image: content.image,
			};
		}
		case "table": {
			const data = content.data;

			const formatMarkdownTableRow = (
				cells: TableCell[] | undefined,
				options: { headerSeperatorOnly: boolean } = {
					headerSeperatorOnly: false,
				},
			) => {
				if (!cells) return "";

				const row = cells.map((cell) => {
					const colSpan = cell.row_span || 1;

					if (colSpan > 1) {
						const emptyCells = Array.from(
							{ length: colSpan - 1 },
							() => `| ${options.headerSeperatorOnly && "---"} |`,
						);
						return `${cell.text} ${emptyCells.join("")}`;
					}

					return options.headerSeperatorOnly ? "---" : cell.text;
				});

				if (row.filter((cell) => cell !== "").length === 0) {
					return "";
				}

				return `| ${row.join(" | ")} | \n`;
			};
			const headerRow = formatMarkdownTableRow(data.grid[0]);
			const headerSeperatorRow = formatMarkdownTableRow(data.grid[0], {
				headerSeperatorOnly: true,
			});

			const bodyRows = data.grid
				.slice(1)
				.map((row) => formatMarkdownTableRow(row))
				.join("");

			const markdownTable = `${headerRow + headerSeperatorRow + bodyRows}\n\n`;
			const { index } = splitRef(content.self_ref);

			return {
				markdown: options.keepMarkdownTables
					? markdownTable
					: `<${content.label}-${index + 1}>\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
				index: index + 1, // 1-based index
				image: content.image,
			};
		}
		default:
			return;
	}
};

/**
 * Retrieves a section from the DoclingDocument based on a reference item.
 *
 * @param ref The reference item pointing to the section.
 * @param doclingDocument The DoclingDocument containing the section.
 * @returns The referenced section item, or undefined if not found.
 */
const getSection = (ref: RefItem, doclingDocument: DoclingDocument) => {
	const { type, index } = splitRef(ref.$ref);

	return doclingDocument[type]?.[index];
};

/**
 * Splits a reference string into its type and index components.
 *
 * @param ref The reference string (e.g., "#/texts/0").
 * @returns An object containing the type (e.g., "texts") and index (e.g., 0).
 */
const splitRef = (
	ref: RefItem["$ref"],
): {
	type: keyof Pick<DoclingDocument, "pictures" | "texts" | "groups" | "tables">;
	index: number;
} => {
	const refComponents = ref.split("/");

	const type = refComponents[1] as keyof Pick<
		DoclingDocument,
		"pictures" | "texts" | "groups" | "tables"
	>;
	const index = Number.parseInt(refComponents[2], 10);

	return {
		type,
		index,
	};
};

/**
 * Formats text based on Docling formatting options.
 *
 * @param formatting Formatting object from Docling.
 * @param text The text to format.
 * @returns The formatted markdown string.
 */
const formatText = (
	formatting: Formatting | null | undefined,
	text: string,
) => {
	if (formatting?.bold) return `**${text}**`;
	if (formatting?.italic) return `*${text}*`;
	if (formatting?.underline) return `__${text}__`;
	if (formatting?.strikethrough) return `~~${text}~~`;

	return text;
};

/**
 * Extracts the page number from provenance information.
 *
 * @param prov An array of ProvenanceItem objects.
 * @returns The page number from the first provenance item, or 0 if provenance is missing or empty.
 */
const extractPageNumber = (prov: ProvenanceItem[] | undefined) => {
	if (!prov || prov.length === 0) {
		return 0; // Default to page 0 if no provenance information is available
	}
	return prov[0].page_no;
};
