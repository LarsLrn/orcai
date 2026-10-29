import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const REGIONAL_LOCALES: Record<string, string> = {
	en: "en-GB",
	de: "de-DE",
};

const getFormatter = (locale: string, withTime: boolean) => {
	const key = `${locale}:${withTime ? "datetime" : "date"}`;
	const cached = formatterCache.get(key);
	if (cached) {
		return cached;
	}

	const formatter = new Intl.DateTimeFormat(
		REGIONAL_LOCALES[locale] ?? locale,
		{
			dateStyle: "medium",
			timeStyle: withTime ? "short" : undefined,
		},
	);
	formatterCache.set(key, formatter);
	return formatter;
};

/** Date and time, written the way the active locale writes it. */
export const formatDisplayTimestamp = (value: Date | string | number) =>
	getFormatter(getLocale(), true).format(new Date(value));

/** Date only, written the way the active locale writes it. */
export const formatDisplayDate = (value: Date | string | number) =>
	getFormatter(getLocale(), false).format(new Date(value));

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const relativeFormatterCache = new Map<string, Intl.RelativeTimeFormat>();

const getRelativeFormatter = (
	locale: string,
	style: Intl.RelativeTimeFormatStyle,
) => {
	const key = `${locale}:${style}`;
	const cached = relativeFormatterCache.get(key);
	if (cached) {
		return cached;
	}

	const formatter = new Intl.RelativeTimeFormat(locale, {
		style,
	});
	relativeFormatterCache.set(key, formatter);
	return formatter;
};

/**
 * How far off a moment is, as "in 3 days": minutes within the hour, hours
 * within the day, and "just now" for the last minute.
 */
export const formatRelativeTime = (
	value: Date | string | number,
	{
		now = Date.now(),
		style = "long",
	}: {
		now?: number;
		style?: Intl.RelativeTimeFormatStyle;
	} = {},
) => {
	const offset = new Date(value).getTime() - now;
	const distance = Math.abs(offset);
	if (offset <= 0 && distance < MINUTE_MS) return m.common_just_now();
	const [unitMs, unit]: [
		number,
		Intl.RelativeTimeFormatUnit,
	] =
		distance < HOUR_MS
			? [
					MINUTE_MS,
					"minute",
				]
			: distance < DAY_MS
				? [
						HOUR_MS,
						"hour",
					]
				: [
						DAY_MS,
						"day",
					];
	const amount = Math.max(Math.round(distance / unitMs), 1);

	return getRelativeFormatter(getLocale(), style).format(
		offset < 0 ? -amount : amount,
		unit,
	);
};
