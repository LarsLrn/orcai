import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	emailNotificationSchema,
	type RenderedEmail,
	renderEmail,
} from "@orcai/notifications/render";
import { expect } from "@playwright/test";
import type { Outbox, OutboxEntry } from "../outbox";

type Locale = "en" | "de";

const MESSAGES_DIR = join(
	import.meta.dirname,
	"../../../../packages/notifications/messages",
);

const catalogues = new Map<Locale, Record<string, unknown>>();

/** The text of an email message key, read from the notifications catalogue. */
export const emailMessage = (
	key: string,
	variables: Record<string, string> = {},
	locale: Locale = "en",
): string => {
	let catalogue = catalogues.get(locale);

	if (!catalogue) {
		catalogue = JSON.parse(
			readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8"),
		) as Record<string, unknown>;
		catalogues.set(locale, catalogue);
	}

	const value = catalogue[key];

	if (typeof value !== "string") {
		throw new Error(
			`Email message "${key}" is not a plain string in ${locale}.json.`,
		);
	}

	return value.replace(/\{(\w+)\}/g, (_match, name: string) => {
		const variable = variables[name];

		if (variable === undefined) {
			throw new Error(`Email message "${key}" needs a value for "${name}".`);
		}

		return variable;
	});
};

/** Wait for the newest queued notification of a type and return it. */
export const queuedEmail = async (
	outbox: Outbox,
	email: string,
	type: string,
): Promise<OutboxEntry> => {
	let entry: OutboxEntry | undefined;

	await expect
		.poll(
			async () => {
				entry = await outbox.latestFor(email, type);

				return entry;
			},
			{
				timeout: 15_000,
			},
		)
		.toBeDefined();

	if (!entry) {
		throw new Error(`No ${type} notification was queued for ${email}.`);
	}

	return entry;
};

/** Render a queued notification the way the worker sends it. */
export const renderQueued = async (
	entry: OutboxEntry,
): Promise<RenderedEmail> =>
	await renderEmail(emailNotificationSchema.parse(entry.payload));

/**
 * Assert that a queued notification asks for `locale` and renders in it: the
 * subject, one line of the text part, and the document language.
 */
export const expectEmailIn = async (
	entry: OutboxEntry,
	locale: Locale,
	copy: {
		subject: string;
		subjectVariables?: Record<string, string>;
		text: string;
	},
): Promise<void> => {
	expect(entry.payload.locale).toBe(locale);

	const email = await renderQueued(entry);

	expect(email.subject).toBe(
		emailMessage(copy.subject, copy.subjectVariables, locale),
	);
	expect(email.text).toContain(emailMessage(copy.text, {}, locale));
	expect(email.html).toMatch(new RegExp(`<html[^>]* lang="${locale}"`));
};
