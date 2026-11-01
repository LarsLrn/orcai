import {
	isOrganizationDescriptionHref,
	ORGANIZATION_DESCRIPTION_HEADING_LEVELS,
} from "@orcai/schema";
import { mergeAttributes } from "@tiptap/core";
import { CharacterCount } from "@tiptap/extension-character-count";
import { Color } from "@tiptap/extension-color";
import { Heading } from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { createColGroup, Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { MathExtension } from "./extensions/math";
import { TiptapYoutube } from "./extensions/youtube";

const TiptapStarterKit = StarterKit.configure({
	bulletList: {
		HTMLAttributes: {
			class: cn("-mt-2 list-outside list-disc leading-3"),
		},
	},
	orderedList: {
		HTMLAttributes: {
			class: cn("-mt-2 list-outside list-decimal leading-3"),
		},
	},
	listItem: {
		HTMLAttributes: {
			class: cn("-mb-2 leading-normal"),
		},
	},
	blockquote: {
		HTMLAttributes: {
			class: cn("border-gray-600 border-l-4"),
		},
	},
	codeBlock: false,
	code: {
		HTMLAttributes: {
			class: cn(
				"rounded-lg bg-muted px-1.5 py-1 font-medium font-mono text-red-700 before:content-none after:content-none dark:bg-muted/90 dark:text-red-400",
			),
		},
	},
	horizontalRule: {
		HTMLAttributes: {
			class: cn("my-4 border-border bg-border"),
		},
	},
	dropcursor: {
		color: "#DBEAFE",
		width: 4,
	},
	// gapcursor: false,
	heading: false,
});

const TiptapHeading = Heading.extend({
	renderHTML({ node, HTMLAttributes }) {
		const hasLevel = this.options.levels.includes(node.attrs.level);
		const level = hasLevel ? node.attrs.level : this.options.levels[0];

		if (node.textContent) {
			return [
				`h${level}`,
				mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
					id: node.textContent.replaceAll(/\s+/g, "-").toLowerCase(),
				}),
				0,
			];
		}
		return [
			`h${level}`,
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0,
		];
	},
});

const TiptapTextAlign = TextAlign.configure({
	types: [
		"heading",
		"paragraph",
		"math",
	],
});

const TiptapTable = Table.extend({
	renderHTML({ node, HTMLAttributes }) {
		const { colgroup, tableWidth, tableMinWidth } = createColGroup(
			node,
			this.options.cellMinWidth,
		);

		const table: DOMOutputSpec = [
			"div",
			{
				class: "table-wrapper overflow-y-auto my-[1em] not-draggable",
			},
			[
				"table",
				mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
					style: tableWidth
						? `width: ${tableWidth}`
						: `min-width: ${tableMinWidth}`,
				}),
				colgroup,
				[
					"tbody",
					0,
				],
			],
		];

		return table;
	},
}).configure({
	HTMLAttributes: {
		class: cn("not-prose w-full table-auto border-collapse"),
	},
	lastColumnResizable: false,
	allowTableNodeSelection: true,
});

const TiptapTableHeader = TableHeader.configure({
	HTMLAttributes: {
		class: cn(
			"min-w-[150px] border border-default bg-muted p-2 text-start font-semibold dark:bg-gray-900",
		),
	},
});

const TiptapTableCell = TableCell.configure({
	HTMLAttributes: {
		class: cn("min-w-[150px] border border-default p-2 align-middle"),
	},
});

const DragHandle = GlobalDragHandle.configure({
	dragHandleWidth: 25,
	excludedTags: [
		"table",
	],
});

const TiptapCharacterCount = CharacterCount;

// const selection = Selection.configure({
//   HTMLAttributes: {
//     class: "selection",
//   },
// });

const placeholder = Placeholder.configure({
	emptyNodeClass: "is-editor-empty",
	placeholder: ({ node }) => {
		switch (node.type.name) {
			case "heading":
				return m.editor_placeholder_heading({
					level: node.attrs.level,
				});
			case "detailsSummary":
				return m.editor_placeholder_section_title();
			case "codeBlock":
				// never show the placeholder when editing code
				return "";
			default:
				return m.editor_placeholder_default();
		}
	},
	includeChildren: false,
});

export const extensions = [
	TiptapStarterKit,
	TiptapHeading,
	TiptapTextAlign,
	TiptapTable,
	TiptapTableHeader,
	TableRow,
	TiptapTableCell,
	TiptapYoutube,
	TiptapCharacterCount,
	TextStyle,
	DragHandle,
	placeholder,
	Subscript,
	Superscript,
	Color,
	Highlight.configure({
		multicolor: true,
	}),
	MathExtension,
	Typography,
];

/** An organisation's description: text, headings, lists, quotes and links. */
export const descriptionExtensions = [
	StarterKit.configure({
		code: false,
		codeBlock: false,
		dropcursor: false,
		heading: {
			levels: [
				...ORGANIZATION_DESCRIPTION_HEADING_LEVELS,
			],
		},
		link: {
			openOnClick: false,
			defaultProtocol: "https",
			isAllowedUri: isOrganizationDescriptionHref,
		},
	}),
	placeholder,
	Typography,
];
