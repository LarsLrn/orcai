import {
	type Browser,
	type CDPSession,
	devices,
	type Locator,
	type Page,
} from "@playwright/test";
import {
	chatName,
	createChat,
	openChat,
	sendTurn,
	setUpChatModel,
} from "../../fixtures/chat/chat";
import type { Role, WorkerOrganisation } from "../../fixtures/index";
import { expect, test } from "../../fixtures/inference/fixture";
import { message } from "../../fixtures/messages";
import { enterApp, open } from "../../fixtures/navigation";

const PHONE = devices["Pixel 7"];

/** A touch phone page, entered at desktop width because the organisation picker needs it. */
const phonePage = async (params: {
	browser: Browser;
	org: WorkerOrganisation;
	role: Role;
	seedZedToken: (page: Page) => Promise<void>;
	height?: number;
}) => {
	const context = await params.browser.newContext({
		...PHONE,
		viewport: {
			width: 1280,
			height: 900,
		},
		storageState: params.org.storageStates[params.role],
		locale: "en",
	});
	const page = await context.newPage();
	await params.seedZedToken(page);
	await enterApp(page, params.org.slug);
	await page.setViewportSize({
		width: PHONE.viewport.width,
		height: params.height ?? PHONE.viewport.height,
	});
	return {
		page,
		cdp: await context.newCDPSession(page),
	};
};

/** Wait until the drawer's slide-in transition has finished. */
const settled = (drawer: Locator) =>
	drawer.evaluate((node) =>
		Promise.all(
			(
				node as unknown as {
					getAnimations: () => {
						finished: Promise<unknown>;
					}[];
				}
			)
				.getAnimations()
				.map((animation) => animation.finished),
		),
	);

/** Drag one finger vertically, as a phone sends it, in frame-sized steps. */
const drag = async (
	page: Page,
	cdp: CDPSession,
	from: {
		x: number;
		y: number;
	},
	distanceY: number,
) => {
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [
			from,
		],
	});
	for (let step = 1; step <= 12; step++) {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [
				{
					x: from.x,
					y: from.y + (distanceY * step) / 12,
				},
			],
		});
		await page.waitForTimeout(16);
	}
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
};

/** Where `target` sits on the page, read once it has settled. */
const boxOf = async (target: Locator) => {
	const box = await target.boundingBox();
	if (!box) throw new Error("The drawer has no box");
	return box;
};

test("layout: on a touch phone the usage drawer closes with a swipe down", async ({
	api,
	browser,
	inference,
	org,
	seedZedToken,
}) => {
	const model = await setUpChatModel(api, inference, {
		meteringMode: "requests",
		budgetAmount: 4,
	});
	const member = api.as("member");
	const chatId = await createChat(member, model, chatName("Swipe"));
	await sendTurn({
		client: member,
		inference,
		chatId,
		turn: {
			question: "Name a primary colour.",
			reply: "Red is a primary colour.",
		},
	});

	const { page, cdp } = await phonePage({
		browser,
		org,
		role: "member",
		seedZedToken,
	});
	await openChat(page, chatId);
	await page
		.getByRole("button", {
			name: message("chat_usage_trigger_aria_label"),
		})
		.tap();
	const drawer = page.getByRole("dialog", {
		name: message("chat_usage_title"),
	});
	await settled(drawer);

	const box = await boxOf(drawer);
	await drag(
		page,
		cdp,
		{
			x: box.x + box.width / 2,
			y: box.y + 8,
		},
		400,
	);
	await expect(drawer).toBeHidden();
	await page.context().close();
});

test("layout: on a short touch phone the filters drawer scrolls to its last option", async ({
	browser,
	org,
	seedZedToken,
}) => {
	const { page, cdp } = await phonePage({
		browser,
		org,
		role: "member",
		seedZedToken,
		height: 420,
	});
	await open(page, "/app/library/bots");
	await page
		.getByRole("button", {
			name: message("browse_filters_action"),
		})
		.tap();
	const drawer = page.getByRole("dialog", {
		name: message("browse_filters_title"),
	});
	await expect(drawer).toBeVisible();
	await settled(drawer);
	const last = drawer.getByRole("checkbox").last();
	await expect(last).not.toBeInViewport();

	// A finger moving up inside the list scrolls it instead of moving the drawer.
	const box = await boxOf(drawer);
	await drag(
		page,
		cdp,
		{
			x: box.x + box.width / 2,
			y: box.y + box.height - 24,
		},
		-180,
	);

	await expect(last).toBeInViewport();
	await expect(drawer).toBeVisible();
	await last.tap();
	await expect(last).toBeChecked();
	await page.context().close();
});
