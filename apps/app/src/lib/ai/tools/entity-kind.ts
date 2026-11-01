import type {
	AssetId,
	BlockId,
	BotId,
	GroupId,
	OrganizationInvitationId,
	UserId,
} from "@orcai/core";
import type { BlockType, ErrorReason, NotFoundEntity } from "@orcai/schema";
import type { orpc } from "@/lib/orpc/orpc";

type ORPCUtils = typeof orpc;

interface EntityKindSpec {
	/** As the model reads it: "No group with id …". */
	label: string;
	/** Concrete kinds only; listed in the hint that ids of other kinds do not fit. */
	plural?: string;
	/** The concrete kinds whose ids this kind takes. */
	covers?: readonly string[];
	/** A block type: the reason a block of the other type fails with. */
	block?: {
		wrongTypeReason: ErrorReason;
	};
	/** Failure reasons, and NOT_FOUND entities, that mean there is no such one. */
	missing: {
		reasons: readonly ErrorReason[];
		entities: readonly NotFoundEntity[];
	};
	/** The output field that names one, and the browser's query for it. */
	name: {
		field: "name" | "title" | "email";
		query: (
			orpc: ORPCUtils,
			id: string,
			zedToken: string | undefined,
		) => unknown;
	};
}

const blockName = {
	field: "name",
	query: (orpc: ORPCUtils, id: string, zedToken: string | undefined) =>
		orpc.block.find.queryOptions({
			input: {
				id: id as BlockId,
				zedToken,
			},
			select: ({ data }) => data.name,
		}),
} as const;

const kinds = {
	bot: {
		label: "bot",
		plural: "bots",
		missing: {
			reasons: [
				"BOT_NOT_FOUND",
			],
			entities: [
				"bot",
			],
		},
		name: {
			field: "name",
			query: (orpc: ORPCUtils, id: string, zedToken: string | undefined) =>
				orpc.bot.find.queryOptions({
					input: {
						id: id as BotId,
						zedToken,
					},
					select: ({ data }) => data.name,
				}),
		},
	},
	behaviour: {
		label: "behaviour",
		plural: "behaviours",
		block: {
			wrongTypeReason: "BEHAVIOUR_BLOCK_TYPE_INVALID",
		},
		missing: {
			reasons: [
				"BLOCK_NOT_FOUND",
			],
			entities: [
				"block",
			],
		},
		name: blockName,
	},
	repository: {
		label: "repository",
		plural: "repositories",
		block: {
			wrongTypeReason: "REPOSITORY_BLOCK_TYPE_INVALID",
		},
		missing: {
			reasons: [
				"BLOCK_NOT_FOUND",
				"REPOSITORY_NOT_FOUND",
			],
			entities: [
				"block",
				"repository",
			],
		},
		name: blockName,
	},
	block: {
		label: "behaviour or repository",
		covers: [
			"behaviour",
			"repository",
		],
		missing: {
			reasons: [
				"BLOCK_NOT_FOUND",
			],
			entities: [
				"block",
			],
		},
		name: blockName,
	},
	asset: {
		label: "asset",
		plural: "assets",
		missing: {
			reasons: [
				"ASSET_NOT_FOUND",
			],
			entities: [
				"asset",
			],
		},
		name: {
			field: "title",
			query: (orpc: ORPCUtils, id: string, zedToken: string | undefined) =>
				orpc.asset.find.queryOptions({
					input: {
						id: id as AssetId,
						zedToken,
					},
					select: ({ data }) => data.title,
				}),
		},
	},
	group: {
		label: "group",
		plural: "groups",
		missing: {
			reasons: [
				"GROUP_NOT_FOUND",
			],
			entities: [
				"group",
			],
		},
		name: {
			field: "name",
			query: (orpc: ORPCUtils, id: string) =>
				orpc.group.find.queryOptions({
					input: {
						id: id as GroupId,
					},
					select: ({ data }) => data.name,
				}),
		},
	},
	member: {
		label: "member",
		plural: "members",
		missing: {
			reasons: [
				"MEMBER_NOT_FOUND",
				"USER_NOT_FOUND",
			],
			entities: [
				"member",
				"user",
			],
		},
		name: {
			field: "name",
			query: (orpc: ORPCUtils, id: string, zedToken: string | undefined) =>
				orpc.organizationMember.find.queryOptions({
					input: {
						userId: id as UserId,
						zedToken,
					},
					select: ({ data }) => data.name,
				}),
		},
	},
	invitation: {
		label: "invitation",
		plural: "invitations",
		missing: {
			reasons: [
				"INVITATION_NOT_FOUND",
			],
			entities: [
				"invitation",
			],
		},
		name: {
			field: "email",
			query: (orpc: ORPCUtils, id: string) =>
				orpc.organizationInvitation.find.queryOptions({
					input: {
						id: id as OrganizationInvitationId,
					},
					select: ({ data }) => data.email,
				}),
		},
	},
} as const satisfies Record<string, EntityKindSpec>;

/** What a tool reads, changes or names, as its output's `type` names it. */
export type EntityKind = keyof typeof kinds;

/** The kinds a block is, by its type. */
export type BlockKind = {
	[Kind in EntityKind]: (typeof kinds)[Kind] extends {
		block: object;
	}
		? Kind
		: never;
}[EntityKind];

/** An id of a kind, as a summary line names it. */
export interface EntityRef {
	kind: EntityKind;
	id: string;
}

const specs: Record<EntityKind, EntityKindSpec> = kinds;

const entries = Object.entries(specs) as [
	EntityKind,
	EntityKindSpec,
][];

const otherPlurals = (kind: EntityKind) => {
	const covered = specs[kind].covers ?? [
		kind,
	];

	return entries.flatMap(([other, { plural }]) =>
		plural === undefined || covered.includes(other)
			? []
			: [
					plural,
				],
	);
};

/**
 * `REASON: No group with id <id>.`, plus the hint that ids of other kinds do
 * not fit, so the model notices it passed a bot id as a group id.
 */
export const wrongIdText = (
	kind: EntityKind,
	ids: string | readonly string[],
	reason: string,
) => {
	const list =
		typeof ids === "string"
			? [
					ids,
				]
			: ids;
	const { label } = specs[kind];
	const subject =
		list.length === 1
			? `No ${label} with id ${list[0]}.`
			: `No ${label} with one of the ids ${list.join(", ")}.`;

	return `${reason}: ${subject} Ids of other kinds (${otherPlurals(kind).join(", ")}) are not ${label} ids.`;
};

/** `wrongIdText` for a block of the other type, naming what it is. */
export const wrongBlockText = (
	expected: BlockKind,
	id: string,
	actual: BlockType,
) => {
	return `${wrongIdText(expected, id, kinds[expected].block.wrongTypeReason)} That id is a ${kinds[actual].label}.`;
};

/**
 * Whether a failure means there is no such `kind`: by its reason, or, without
 * one, by its NOT_FOUND entity. A block of the other type counts as missing.
 */
export const isMissing = (
	kind: EntityKind,
	failure: {
		reason?: string;
		entity?: string;
	},
) => {
	const { block, missing } = specs[kind];
	const reasons: readonly string[] = block
		? [
				...missing.reasons,
				block.wrongTypeReason,
			]
		: missing.reasons;
	const entities: readonly string[] = missing.entities;

	return failure.reason !== undefined
		? reasons.includes(failure.reason)
		: failure.entity === undefined || entities.includes(failure.entity);
};

/** The output fields that name an entity; where several are present, the first names it. */
export const NAME_FIELDS = [
	...new Set(entries.map(([, spec]) => spec.name.field)),
];

/** The browser's query for the ref's name. */
export const nameQuery = (
	utils: ORPCUtils,
	{ kind, id }: EntityRef,
	zedToken: string | undefined,
) => kinds[kind].name.query(utils, id, zedToken);
