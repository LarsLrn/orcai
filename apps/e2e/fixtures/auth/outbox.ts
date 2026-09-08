import { expect } from "@playwright/test";
import type { Outbox } from "../outbox";

/** Wait for the newest queued notification of a type and return its link. */
export const waitForLink = async (
	outbox: Outbox,
	email: string,
	type: string,
): Promise<string> => {
	let url: string | undefined;

	await expect
		.poll(
			async () => {
				url = (await outbox.latestFor(email, type))?.url;

				return url;
			},
			{
				timeout: 15_000,
			},
		)
		.toBeDefined();

	if (!url) {
		throw new Error(`No ${type} link was queued for ${email}.`);
	}

	return url;
};
