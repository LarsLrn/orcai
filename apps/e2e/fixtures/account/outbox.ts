import { expect } from "@playwright/test";
import type { Outbox } from "../outbox";

/** The outbox type Better Auth's verification mail is queued as. */
export const VERIFY_EMAIL_NOTIFICATION = "auth.verify-email";

/** The newest verification mail queued for an address; sign-up already queues one. */
export const latestVerificationId = async (
	outbox: Outbox,
	email: string,
): Promise<string | undefined> =>
	(await outbox.latestFor(email, VERIFY_EMAIL_NOTIFICATION))?.id;

/** Wait for a verification mail newer than `previousId` and return its link. */
export const waitForNewVerificationLink = async (
	outbox: Outbox,
	email: string,
	previousId: string | undefined,
): Promise<string> => {
	let url: string | undefined;

	await expect
		.poll(
			async () => {
				const entry = await outbox.latestFor(email, VERIFY_EMAIL_NOTIFICATION);

				if (!entry || entry.id === previousId) {
					return undefined;
				}

				url = entry.url;

				return entry.id;
			},
			{
				timeout: 15_000,
			},
		)
		.toBeDefined();

	if (!url) {
		throw new Error(`No verification link was queued for ${email}.`);
	}

	return url;
};
