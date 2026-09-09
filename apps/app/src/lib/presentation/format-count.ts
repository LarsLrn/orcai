import { formatCount } from "./format-number";

/** Counts are read at a glance, so they are grouped the way en-GB groups them. */
const formatCountOf = (value: number, singular: string, plural: string) =>
	`${formatCount(value)} ${value === 1 ? singular : plural}`;

export { formatCount, formatCountOf };
