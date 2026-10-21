import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { v1 } from "@authzed/authzed-node";
import * as Effect from "effect/Effect";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { SpiceDbLive, SpiceDbService } from "../src/service";
import { createConsistency } from "../src/utils";

const relationships = [
	"organization:org1#admin@user:admin1",
	"organization:org1#manager@user:manager_org1",
	"organization:org1#member@user:member1",
	"organization:org1#viewer@user:viewer_org1",

	"group:group1#organization@organization:org1",
	"group:group1#member@user:groupmember1",
	"group:allmembers1#organization@organization:org1",
	"group:allmembers1#member@organization:org1#admin",
	"group:allmembers1#member@organization:org1#manager",
	"group:allmembers1#member@organization:org1#member",
	"group:allmembers1#member@organization:org1#viewer",

	"bot:bot1#owner@user:admin1",
	"bot:bot1#manager@user:manager1",
	"bot:bot1#editor@user:editor1",
	"bot:bot1#viewer@user:viewer1",
	"bot:bot1#public@user:*",

	"block:block1#owner@user:admin1",
	"block:block1#bot@bot:bot1",

	"asset:asset1#owner@user:admin1",
	"asset:asset1#block@block:block1",

	"chat:chat1#owner@user:member1",
	"chat:chat1#bot@bot:bot1",
];

const granted = [
	"bot:bot1#read@user:viewer2",
	"bot:bot1#edit@user:editor1",
	"bot:bot1#manage_access@user:manager1",
	"block:block1#read@user:viewer2",
	"block:block1#read@user:editor1",
	"asset:asset1#read@user:editor1",
	"asset:asset1#download@user:viewer2",
	"asset:asset1#fork@user:viewer1",
	"bot:bot1#read@user:anyone",
	"chat:chat1#read@user:member1",
	"organization:org1#manage_members@user:manager_org1",
	"organization:org1#create_bot@user:member1",
	"organization:org1#read@user:viewer_org1",
	"group:group1#manage@user:admin1",
	"group:group1#manage@user:manager_org1",
];

const denied = [
	"organization:org1#manage_members@user:member1",
	"organization:org1#create_asset@user:viewer_org1",
	"organization:org1#manage_providers@user:manager_org1",
	"bot:bot1#edit@user:manager_org2",
	"bot:bot1#manage_access@user:editor1",
	"block:block1#manage_access@user:viewer2",
	"asset:asset1#edit@user:viewer2",
	"block:block1#edit@user:editor1",
	"asset:asset1#edit@user:editor1",
	"chat:chat1#read@user:admin1",
	"group:group1#manage@user:member1",
];

// Ids get a per-run prefix so runs coexist with each other and with dev data.
const run = crypto.randomUUID();
const tuplePattern = /^(\w+):(\w+)#(\w+)@(\w+):(\w+|\*)(?:#(\w+))?$/;

const parse = (tuple: string) => {
	const match = tuplePattern.exec(tuple);
	if (!match) throw new Error(`Unparseable tuple ${tuple}`);
	const [, resourceType, resourceId, relation, subjectType, subjectId, sub] =
		match;
	return {
		resource: v1.ObjectReference.create({
			objectType: resourceType,
			objectId: `${run}-${resourceId}`,
		}),
		relation,
		subject: v1.SubjectReference.create({
			object: v1.ObjectReference.create({
				objectType: subjectType,
				objectId: subjectId === "*" ? "*" : `${run}-${subjectId}`,
			}),
			optionalRelation: sub,
		}),
	};
};

const runtime = ManagedRuntime.make(SpiceDbLive);
let zedToken: string | undefined;

beforeAll(async () => {
	zedToken = await runtime.runPromise(
		Effect.gen(function* () {
			const { spice } = yield* SpiceDbService;
			const response = yield* Effect.promise(() =>
				spice.writeRelationships(
					v1.WriteRelationshipsRequest.create({
						updates: relationships.map((tuple) =>
							v1.RelationshipUpdate.create({
								relationship: v1.Relationship.create(parse(tuple)),
								operation: v1.RelationshipUpdate_Operation.CREATE,
							}),
						),
					}),
				),
			);
			return response.writtenAt?.token;
		}),
	);
});

afterAll(() => runtime.dispose());

const check = (assertion: string) =>
	runtime.runPromise(
		Effect.gen(function* () {
			const { spice } = yield* SpiceDbService;
			const { resource, relation, subject } = parse(assertion);
			const response = yield* Effect.promise(() =>
				spice.checkPermission(
					v1.CheckPermissionRequest.create({
						consistency: createConsistency({
							zedToken,
						}),
						resource,
						permission: relation,
						subject,
					}),
				),
			);
			return (
				response.permissionship ===
				v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION
			);
		}),
	);

describe("schema.zed", () => {
	test.each(granted)("grants %s", async (assertion) => {
		expect(await check(assertion)).toBe(true);
	});

	test.each(denied)("denies %s", async (assertion) => {
		expect(await check(assertion)).toBe(false);
	});
});
