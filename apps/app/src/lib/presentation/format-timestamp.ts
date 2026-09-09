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
