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

interface SectionContentBase {
	markdown: string;
	page: number;
}

interface PictureChartTypeSectionContent extends SectionContentBase {
	label: PictureItem["label"];
	index: number;
	image: ImageRef | undefined | null;
}

interface TableTypeSectionContent extends SectionContentBase {
	label: TableItem["label"];
	index: number;
	image: ImageRef | undefined | null;
}

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

export type SectionContent =
	| PictureChartTypeSectionContent
	| TableTypeSectionContent
	| OtherTypeSectionContent;

interface SerializationOptions {
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
	)[];
}

export const serializeDoclingDocument = (
	doclingDocument: DoclingDocument,
	options: SerializationOptions,
): SerializedDocument[] | undefined => {
	const {
		keepFooter = false,
		keepHeader = false,
		keepImageRefs = true,
		keepMarkdownTables = true,
	} = options;

	const serializedDocument: SectionContent[] = [];
	const refs = doclingDocument.body?.children;

	if (!refs) {
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

	const mergedDocument: {
		[page: number]: SerializedDocument;
	} = {};

	for (const item of serializedDocument) {
		const page = item.page;

		if (!mergedDocument[page]) {
			mergedDocument[page] = {
				markdown: "",
				page,
				images: [],
			};
		}
		const updatedMarkdown = mergedDocument[page].markdown + item.markdown;

		const image =
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
			image &&
			(item.label === "picture" ||
				item.label === "chart" ||
				item.label === "table")
		) {
			images.push({
				label: item.label,
				index: item.index,
				...image,
			});
		}

		mergedDocument[page] = {
			page,
			markdown: updatedMarkdown,
			images: mergedDocument[page].images.concat(images),
		};
	}

	return Object.entries(mergedDocument).map(([page, doc]) => ({
		page: Number(page),
		markdown: doc.markdown,
		images: doc.images,
	}));
};

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
	options: SerializationOptions,
): SectionContent | undefined => {
	switch (content.label) {
		case "caption":
			return {
				markdown: `## ${content.text}\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
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
			const level = content.level || 2;
			return {
				markdown: `#${"#".repeat(level)} ${formatText(content.formatting, content.text)}\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		}
		case "page_footer":
			if (!options.keepFooter) return;
			return {
				markdown: `---\n${formatText(content.formatting, content.text)}\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
		case "page_header":
			if (!options.keepHeader) return;
			return {
				markdown: `---\n${formatText(content.formatting, content.text)}\n\n`,
				page: extractPageNumber(content.prov),
				label: content.label,
			};
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
				index: splitRef(content.self_ref).index + 1,
				image: content.image,
			};
		}
		case "table": {
			const formatMarkdownTableRow = (
				cells: TableCell[] | undefined,
				rowOptions: {
					headerSeperatorOnly: boolean;
				} = {
					headerSeperatorOnly: false,
				},
			) => {
				if (!cells) return "";

				const row = cells.map((cell) => {
					const colSpan = cell.row_span || 1;

					if (colSpan > 1) {
						const emptyCells = Array.from(
							{
								length: colSpan - 1,
							},
							() => `| ${rowOptions.headerSeperatorOnly && "---"} |`,
						);
						return `${cell.text} ${emptyCells.join("")}`;
					}

					return rowOptions.headerSeperatorOnly ? "---" : cell.text;
				});

				if (row.filter((cell) => cell !== "").length === 0) {
					return "";
				}

				return `| ${row.join(" | ")} | \n`;
			};
			const headerRow = formatMarkdownTableRow(content.data.grid[0]);
			const headerSeperatorRow = formatMarkdownTableRow(content.data.grid[0], {
				headerSeperatorOnly: true,
			});
			const bodyRows = content.data.grid
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
				index: index + 1,
				image: content.image,
			};
		}
		default:
			return;
	}
};

const getSection = (ref: RefItem, doclingDocument: DoclingDocument) => {
	const { type, index } = splitRef(ref.$ref);

	return doclingDocument[type]?.[index];
};

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

const extractPageNumber = (prov: ProvenanceItem[] | undefined) => {
	if (!prov || prov.length === 0) {
		return 0;
	}
	return prov[0].page_no;
};
