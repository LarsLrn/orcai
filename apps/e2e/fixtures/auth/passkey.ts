import { createHash, createPrivateKey, sign } from "node:crypto";
import { type APIResponse, expect, type Page } from "@playwright/test";
import { openAccountPage } from "../account/navigation";
import { message } from "../messages";

/** The parts of a virtual authenticator's credential a signed assertion needs. */
type StoredCredential = {
	credentialId: string;
	/** PKCS#8, base64. */
	privateKey: string;
	signCount: number;
	userHandle?: string;
};

const AUTHENTICATOR = {
	protocol: "ctap2",
	transport: "internal",
	hasResidentKey: true,
	automaticPresenceSimulation: true,
} as const;

/**
 * A platform authenticator for `page` that answers every prompt by itself,
 * like a device unlocked with a fingerprint.
 */
export const addVirtualAuthenticator = async (
	page: Page,
): Promise<{
	/** Moves the passkeys to a key that only proves presence, without a PIN. */
	dropUserVerification: () => Promise<void>;
	credentials: () => Promise<StoredCredential[]>;
}> => {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("WebAuthn.enable");
	let { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
		options: {
			...AUTHENTICATOR,
			hasUserVerification: true,
			isUserVerified: true,
		},
	});
	const credentials = async () =>
		(
			await cdp.send("WebAuthn.getCredentials", {
				authenticatorId,
			})
		).credentials;

	return {
		dropUserVerification: async () => {
			const moved = await credentials();
			await cdp.send("WebAuthn.removeVirtualAuthenticator", {
				authenticatorId,
			});
			({ authenticatorId } = await cdp.send(
				"WebAuthn.addVirtualAuthenticator",
				{
					options: {
						...AUTHENTICATOR,
						hasUserVerification: false,
					},
				},
			));
			for (const credential of moved)
				await cdp.send("WebAuthn.addCredential", {
					authenticatorId,
					credential,
				});
		},
		credentials,
	};
};

/** Registers a passkey from the Security tab and waits until the list shows it. */
export const addPasskey = async (page: Page): Promise<void> => {
	await openAccountPage(page, "security");
	await page
		.getByRole("button", {
			name: message("passkey_add_button"),
		})
		.click();
	await expect(
		page
			.getByRole("list", {
				name: message("passkey_list_label"),
			})
			.getByRole("listitem"),
	).toHaveCount(1);
};

/** Signs out on this browser only, keeping its authenticator. */
export const dropSession = async (page: Page): Promise<void> => {
	await page.context().clearCookies({
		name: /session_token/,
	});
};

const base64url = (bytes: Buffer) => bytes.toString("base64url");

const signCountAfter = (signCount: number) => {
	const bytes = Buffer.alloc(4);
	bytes.writeUInt32BE(signCount + 1);
	return bytes;
};

/**
 * Answers the app's passkey challenge with a stored credential, signed here
 * instead of by a browser, so a test can send flags no browser would. Returns
 * Better Auth's response to the assertion.
 */
export const assertPasskey = async (
	page: Page,
	credential: StoredCredential,
	flags: {
		userVerified: boolean;
	},
): Promise<APIResponse> => {
	const options = (await (
		await page.request.get("/api/auth/passkey/generate-authenticate-options")
	).json()) as {
		challenge: string;
		rpId: string;
	};
	const origin = new URL(page.url()).origin;
	const clientDataJSON = Buffer.from(
		JSON.stringify({
			type: "webauthn.get",
			challenge: options.challenge,
			origin,
			crossOrigin: false,
		}),
	);
	// User present, and user verified when asked for.
	const flagByte = flags.userVerified ? 0x05 : 0x01;
	const authenticatorData = Buffer.concat([
		createHash("sha256").update(options.rpId).digest(),
		Buffer.from([
			flagByte,
		]),
		signCountAfter(credential.signCount),
	]);
	const key = createPrivateKey({
		key: Buffer.from(credential.privateKey, "base64"),
		format: "der",
		type: "pkcs8",
	});
	// Ed25519 hashes internally; ES256 signs a SHA-256 digest.
	const signature = sign(
		key.asymmetricKeyType === "ed25519" ? null : "sha256",
		Buffer.concat([
			authenticatorData,
			createHash("sha256").update(clientDataJSON).digest(),
		]),
		key,
	);
	const id = base64url(Buffer.from(credential.credentialId, "base64"));

	return await page.request.post("/api/auth/passkey/verify-authentication", {
		headers: {
			origin,
		},
		data: {
			response: {
				id,
				rawId: id,
				type: "public-key",
				clientExtensionResults: {},
				response: {
					clientDataJSON: base64url(clientDataJSON),
					authenticatorData: base64url(authenticatorData),
					signature: base64url(signature),
					userHandle: credential.userHandle
						? base64url(Buffer.from(credential.userHandle, "base64"))
						: undefined,
				},
			},
		},
	});
};
