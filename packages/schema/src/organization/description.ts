import { z } from "zod/v4";

/** The most a description may weigh as JSON. */
export const ORGANIZATION_DESCRIPTION_MAX_LENGTH = 20_000;

export const ORGANIZATION_DESCRIPTION_HEADING_LEVELS = [
	2,
	3,
] as const;

/** The protocols a description's links may use. */
export const ORGANIZATION_DESCRIPTION_LINK_PROTOCOLS = [
	"http:",
	"https:",
	"mailto:",
	"tel:",
] as const;

/** Whether a description may link to `href`. */
export const isOrganizationDescriptionHref = (href: string) => {
	try {
		return (
			ORGANIZATION_DESCRIPTION_LINK_PROTOCOLS as readonly string[]
		).includes(new URL(href).protocol);
	} catch {
		return false;
	}
};

const markSchema = z.discriminatedUnion("type", [
	z.strictObject({
		type: z.enum([
			"bold",
			"italic",
			"underline",
			"strike",
		]),
	}),
	z.strictObject({
		type: z.literal("link"),
		attrs: z.strictObject({
			href: z.string().max(2048).refine(isOrganizationDescriptionHref),
			target: z.literal("_blank").nullable().optional(),
			rel: z.string().max(100).nullable().optional(),
			class: z.null().optional(),
			title: z.string().max(200).nullable().optional(),
		}),
	}),
]);

type DescriptionNode =
	| {
			type: "text";
			text: string;
			marks?: z.infer<typeof markSchema>[];
	  }
	| {
			type:
				| "paragraph"
				| "bulletList"
				| "listItem"
				| "blockquote"
				| "horizontalRule"
				| "hardBreak";
			content?: DescriptionNode[];
	  }
	| {
			type: "orderedList";
			attrs?: {
				start?: number;
				type?: string | null;
			};
			content?: DescriptionNode[];
	  }
	| {
			type: "heading";
			attrs: {
				level: (typeof ORGANIZATION_DESCRIPTION_HEADING_LEVELS)[number];
			};
			content?: DescriptionNode[];
	  };

const content = z.array(z.lazy((): z.ZodType<DescriptionNode> => nodeSchema));

const nodeSchema: z.ZodType<DescriptionNode> = z.discriminatedUnion("type", [
	z.strictObject({
		type: z.literal("text"),
		text: z.string().min(1),
		marks: z.array(markSchema).optional(),
	}),
	z.strictObject({
		type: z.enum([
			"paragraph",
			"bulletList",
			"listItem",
			"blockquote",
			"horizontalRule",
			"hardBreak",
		]),
		content: content.optional(),
	}),
	z.strictObject({
		type: z.literal("orderedList"),
		attrs: z
			.strictObject({
				start: z.number().int().optional(),
				type: z.string().max(10).nullable().optional(),
			})
			.optional(),
		content: content.optional(),
	}),
	z.strictObject({
		type: z.literal("heading"),
		attrs: z.strictObject({
			level: z.union(
				ORGANIZATION_DESCRIPTION_HEADING_LEVELS.map((level) =>
					z.literal(level),
				),
			),
		}),
		content: content.optional(),
	}),
]);

const documentSchema = z.strictObject({
	type: z.literal("doc"),
	content: content.optional(),
});

/**
 * An organisation's description: an editor document of paragraphs, headings,
 * lists, quotes and links on web, mail and phone addresses. Its size is
 * checked before its structure.
 */
export const organizationDescriptionSchema = z
	.unknown()
	.check((ctx) => {
		if (
			(JSON.stringify(ctx.value)?.length ?? 0) >
			ORGANIZATION_DESCRIPTION_MAX_LENGTH
		) {
			ctx.issues.push({
				code: "too_big",
				origin: "string",
				maximum: ORGANIZATION_DESCRIPTION_MAX_LENGTH,
				input: ctx.value,
			});
		}
	})
	.pipe(documentSchema);

export type OrganizationDescription = z.infer<
	typeof organizationDescriptionSchema
>;
