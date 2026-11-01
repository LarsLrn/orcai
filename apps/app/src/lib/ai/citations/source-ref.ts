import type { ChatMessageCitation } from "@orcai/schema";

const REF_SPACE = 36 ** 6;

/** The letter each kind of source's refs start with, so kinds never share a ref. */
const PREFIXES = {
	passage: "k",
	attachment: "a",
	docs: "d",
	web: "w",
} as const;

export type SourceRefKind = keyof typeof PREFIXES;

/** A ref as `sourceRef` writes it, which tags may carry without quotes. */
export const SOURCE_REF = /^[kadw][0-9a-z]{6}$/;

/** A source's short name for the model: its kind's letter and 6 base36 characters of its identity's FNV-1a hash. */
export const sourceRef = (kind: SourceRefKind, identity: string) => {
	let hash = 0x811c9dc5;
	for (let index = 0; index < identity.length; index += 1) {
		hash ^= identity.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return `${PREFIXES[kind]}${((hash >>> 0) % REF_SPACE).toString(36).padStart(6, "0")}`;
};

/** A source a call issued: the ref the model read, what it names, and what a citation of it stores. */
export interface Source {
	ref: string;
	/** Two sources of one identity are one source; two identities on one ref make it ambiguous. */
	identity: string;
	citation: ChatMessageCitation;
}
