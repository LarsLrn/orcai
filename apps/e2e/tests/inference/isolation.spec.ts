import {
	expect,
	INFERENCE_MOCK_MODELS,
	startInferenceMock,
	test,
} from "../../fixtures/inference/fixture";

test.describe.configure({
	mode: "serial",
});

test("a worker can leave scripted settings without changing another server", async ({
	inference,
}) => {
	const other = await startInferenceMock();
	try {
		inference.respondWith({
			text: "stale reply",
		});
		inference.failNext({
			status: 503,
		});
		other.respondWith({
			text: "independent reply",
		});
		const response = await fetch(`${other.url}/chat/completions`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model: INFERENCE_MOCK_MODELS.chat,
				messages: [
					{
						role: "user",
						content: "hello",
					},
				],
			}),
		});
		expect(response.ok).toBe(true);
		expect(await response.text()).toContain("independent reply");
	} finally {
		await other.close();
	}
});

test("the next test starts without the previous scripted settings", async ({
	inference,
}) => {
	expect(inference.requests).toHaveLength(0);
	const response = await fetch(`${inference.url}/chat/completions`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: INFERENCE_MOCK_MODELS.chat,
			messages: [
				{
					role: "user",
					content: "hello",
				},
			],
		}),
	});
	expect(response.ok).toBe(true);
	expect(await response.text()).not.toContain("stale reply");
	const port = Number(new URL(inference.url).port);
	await expect(
		startInferenceMock({
			port,
		}),
	).rejects.toThrow();
});
