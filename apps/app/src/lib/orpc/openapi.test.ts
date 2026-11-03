import { expect, test } from "bun:test";
import { contracts } from "@orcai/contracts";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

test("only the operations without a session override the API's security, with none", async () => {
	const spec = await new OpenAPIGenerator({
		converters: [
			new ZodToJsonSchemaConverter(),
		],
	}).generate(contracts);

	const overriding = Object.fromEntries(
		Object.entries(spec.paths ?? {}).flatMap(([path, operations]) =>
			Object.entries(operations ?? {}).flatMap(([method, operation]) =>
				typeof operation === "object" &&
				operation !== null &&
				"security" in operation
					? [
							[
								`${method} ${path}`,
								operation.security,
							],
						]
					: [],
			),
		),
	);
	expect(overriding).toEqual({
		"get /bootstrap/status": [],
		"post /bootstrap/initialize": [],
		"get /invitations/{id}/validate": [],
	});
});
