import { serverEnv } from "@/lib/env/server";
import { contracts, type OrpcInputs } from "@/lib/orpc/contracts";
import type { TaskUpdate } from "@/lib/orpc/schemas/task";

export const mutateTaskStatus = async ({
	status,
	task,
	resourceId,
	resourceType,
	payload,
	runId,
	startedAt,
	finishedAt,
}: Pick<
	TaskUpdate,
	| "status"
	| "task"
	| "resourceId"
	| "resourceType"
	| "payload"
	| "runId"
	| "startedAt"
	| "finishedAt"
>) => {
	const pathTemplate = contracts.task.update["~orpc"].route.path;
	const method = contracts.task.update["~orpc"].route.method;

	// Replace path parameters with actual values
	const path = pathTemplate?.replace("{resourceId}", resourceId) ?? "/tasks";

	const body: Omit<OrpcInputs["task"]["update"], "resourceId"> = {
		status,
		task,
		resourceType,
		runCount: 0,
		payload,
		runId,
		...(startedAt !== undefined && { startedAt }),
		...(finishedAt !== undefined && { finishedAt }),
	};

	console.log("Path:", path);
	console.log("Body:", body);

	const url = `${serverEnv.BASE_URL}/api/doc${path}`;
	console.log("Trying to fetch", url);

	const response = await fetch(url, {
		method: method,
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("Response error:", response.status, errorText);
		throw new Error(`API request failed: ${response.status} ${errorText}`);
	}

	const responseData = await response.json();
	console.log("Response:", responseData);
};
