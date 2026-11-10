/** Where a question's answer is: a passage that quotes `evidence`, or a figure of the page. */
export interface Source {
	document: string;
	/** Any one of them, for a passage that may sit on either. */
	page: number | number[];
	/**
	 * Quotes the passage must hold, every one, compared on letters and digits
	 * only: a table row's label with its value, so a label without the value
	 * does not count.
	 */
	evidence?: string | string[];
	/** The answer is in a figure on `page`, whose description the model wrote. */
	figure?: true;
}

/** A returned passage as the metrics read it. */
export interface Found {
	document: string;
	source: "text" | "image";
	text: string;
	pageStart?: number;
	pageEnd?: number;
}

/** Letters and digits only, so line breaks, table pipes and words glued at line ends compare equal. */
const normalize = (text: string) =>
	text
		.normalize("NFKC")
		.toLowerCase()
		.replaceAll(/[^\p{L}\p{N}]/gu, "");

const listOf = <T>(value: T | T[] | undefined) =>
	value === undefined
		? []
		: Array.isArray(value)
			? value
			: [
					value,
				];

/** Whether `found` lies on one of the source's pages; with `exact`, on that page alone. */
const onPage = (found: Found, source: Source, exact = false) => {
	const start = found.pageStart;
	if (found.document !== source.document || start === undefined) return false;
	const end = found.pageEnd ?? start;
	if (exact && end !== start) return false;
	return listOf(source.page).some((page) => start <= page && end >= page);
};

const answers = (found: Found, source: Source) => {
	if (found.document !== source.document) return false;
	if (source.figure) return found.source === "image" && onPage(found, source);
	const text = normalize(found.text);
	const quotes = listOf(source.evidence);
	return (
		quotes.length > 0 &&
		quotes.every((evidence) => text.includes(normalize(evidence)))
	);
};

/** The 1-based rank of the first passage that answers from any of `sources`, or null. */
export const rankOf = (
	results: readonly Found[],
	sources: readonly Source[],
) => {
	const index = results.findIndex((found) =>
		sources.some((source) => answers(found, source)),
	);
	return index === -1 ? null : index + 1;
};

/** Whether any passage of `passages` answers from `sources`, so a miss is retrieval's and not extraction's. */
export const answerable = (
	passages: readonly Found[],
	sources: readonly Source[],
) => rankOf(passages, sources) !== null;

/** One question's outcome in one configuration. */
export interface Outcome {
	rank: number | null;
	/** Whether the first result answers and its pages include the expected page, the page a citation of it would name. */
	pageRight: boolean;
	/** Whether the first result answers and names the expected page alone, as a citation shows it. */
	pageExact: boolean;
}

export const outcomeOf = (
	results: readonly Found[],
	sources: readonly Source[],
): Outcome => {
	const rank = rankOf(results, sources);
	// The page must be the one of the source the first result answers from.
	const onAnsweredPage = (exact: boolean) =>
		rank === 1 &&
		sources.some(
			(source) =>
				answers(results[0], source) && onPage(results[0], source, exact),
		);
	return {
		rank,
		pageRight: onAnsweredPage(false),
		pageExact: onAnsweredPage(true),
	};
};

export interface Summary {
	questions: number;
	hitAt1: number;
	hitAt3: number;
	/** Within every returned result. */
	hitAtLimit: number;
	mrr: number;
	pageAt1: number;
	pageExactAt1: number;
}

const share = (
	outcomes: readonly Outcome[],
	pass: (outcome: Outcome) => boolean,
) =>
	outcomes.length === 0 ? 0 : outcomes.filter(pass).length / outcomes.length;

export const summarize = (outcomes: readonly Outcome[]): Summary => ({
	questions: outcomes.length,
	hitAt1: share(outcomes, ({ rank }) => rank === 1),
	hitAt3: share(outcomes, ({ rank }) => rank !== null && rank <= 3),
	hitAtLimit: share(outcomes, ({ rank }) => rank !== null),
	mrr:
		outcomes.length === 0
			? 0
			: outcomes.reduce((sum, { rank }) => sum + (rank ? 1 / rank : 0), 0) /
				outcomes.length,
	pageAt1: share(outcomes, ({ pageRight }) => pageRight),
	pageExactAt1: share(outcomes, ({ pageExact }) => pageExact),
});
