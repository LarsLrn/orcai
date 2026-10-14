import { readFileSync } from "node:fs";
import { join } from "node:path";

const MESSAGES_DIR = join(import.meta.dirname, "../../app/messages");

type Locale = "en" | "de";

type Variables = Record<string, string | number>;

const catalogues = new Map<Locale, Record<string, unknown>>();

const catalogueOf = (locale: Locale): Record<string, unknown> => {
	let catalogue = catalogues.get(locale);

	if (!catalogue) {
		catalogue = JSON.parse(
			readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8"),
		) as Record<string, unknown>;
		catalogues.set(locale, catalogue);
	}

	return catalogue;
};

/**
 * The text the app renders for a message key, read from the source catalogue
 * so a locator follows the copy. Only plain strings resolve here; a message
 * with variants has no single text and needs a locator of its own.
 */
export const message = (
	key: string,
	variables: Variables = {},
	locale: Locale = "en",
): string => {
	const value = catalogueOf(locale)[key];

	if (value === undefined) {
		throw new Error(`Message "${key}" is not in messages/${locale}.json.`);
	}

	if (typeof value !== "string") {
		throw new Error(
			`Message "${key}" has variants; target its rendered text directly.`,
		);
	}

	return value.replace(/\{(\w+)\}/g, (_match, name: string) => {
		const variable = variables[name];

		if (variable === undefined) {
			throw new Error(`Message "${key}" needs a value for "${name}".`);
		}

		return String(variable);
	});
};
