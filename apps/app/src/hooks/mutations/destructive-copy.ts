/**
 * Copy builders for destructive confirmations and their toasts, so every
 * dialog names the object it acts on and every toast agrees with the count.
 */

export type DestructiveNouns = {
	noun: string;
	nounPlural: string;
};

/** What a caller knows about the objects a destructive action targets. */
export type DestructiveTarget = {
	names?: readonly (string | null | undefined)[];
	noun?: string;
	nounPlural?: string;
};

const resolveNoun = (
	count: number,
	nouns: DestructiveNouns,
	target?: DestructiveTarget,
) =>
	count === 1
		? (target?.noun ?? nouns.noun)
		: (target?.nounPlural ?? nouns.nounPlural);

/** "the chat Weekly plan", "this chat", "3 chats". */
export const describeTarget = (
	count: number,
	nouns: DestructiveNouns,
	target?: DestructiveTarget,
) => {
	if (count !== 1) {
		return `${count} ${resolveNoun(count, nouns, target)}`;
	}

	const name = target?.names?.[0]?.trim();
	const noun = resolveNoun(count, nouns, target);

	return name ? `the ${noun} ${name}` : `this ${noun}`;
};

/** "Delete chat", "Delete 3 chats". */
export const describeAction = (
	verb: string,
	count: number,
	nouns: DestructiveNouns,
	target?: DestructiveTarget,
) =>
	count === 1
		? `${verb} ${resolveNoun(count, nouns, target)}`
		: `${verb} ${count} ${resolveNoun(count, nouns, target)}`;

/** "Deleting the chat...", "Deleting 3 chats...". */
export const describeProgress = (
	verb: string,
	count: number,
	nouns: DestructiveNouns,
	target?: DestructiveTarget,
) =>
	count === 1
		? `${verb} the ${resolveNoun(count, nouns, target)}...`
		: `${verb} ${count} ${resolveNoun(count, nouns, target)}...`;

/** "1 chat deleted", "3 chats deleted". */
export const describeOutcome = (
	count: number,
	nouns: DestructiveNouns,
	outcome: string,
	target?: DestructiveTarget,
) => `${count} ${resolveNoun(count, nouns, target)} ${outcome}`;

/** "The chat was not deleted. Try again." */
export const describeFailure = (
	count: number,
	nouns: DestructiveNouns,
	outcome: string,
	target?: DestructiveTarget,
) =>
	`The ${resolveNoun(count, nouns, target)} ${
		count === 1 ? "was" : "were"
	} not ${outcome}. Try again.`;
