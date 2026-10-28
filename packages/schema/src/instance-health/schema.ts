import { z } from "zod/v4";
import { checkSchema } from "../shared/check";

export const INSTANCE_CHECK_IDS = [
	"postgres",
	"spicedb",
	"qdrant",
	"s3",
	"valkey",
	"workers",
	"mail",
	"config",
] as const;

export const instanceCheckIdSchema = z.enum(INSTANCE_CHECK_IDS);

export const instanceCheckSchema = checkSchema.extend({
	id: instanceCheckIdSchema,
});

export const emailDeliveryChannelSchema = z.enum([
	"smtp",
	"log",
]);

export const instanceProcessSchema = z.object({
	name: z.string().nullable(),
	host: z.string(),
	pid: z.number(),
	live: z.boolean(),
	startedOn: z.coerce.date(),
	heartbeatOn: z.coerce.date(),
	lastWorkerErrorOn: z.coerce.date().nullable(),
});

export const instanceQueueSchema = z.object({
	name: z.string(),
	deadLetter: z.string().nullable(),
	queued: z.number(),
	active: z.number(),
	failed: z.number(),
});

export const instanceMailSchema = z.object({
	pending: z.number(),
	dead: z.number(),
	lastError: z.string().nullable(),
	lastDeliveryChannel: emailDeliveryChannelSchema.nullable(),
	/** The newest test email the viewing admin asked for. */
	testEmail: z
		.object({
			status: z.enum([
				"pending",
				"processing",
				"sent",
				"dead",
			]),
			deliveryChannel: emailDeliveryChannelSchema.nullable(),
			createdAt: z.coerce.date(),
			sentAt: z.coerce.date().nullable(),
		})
		.nullable(),
});

/** A setting of the app process; secrets only say whether they are set. */
export const configEntrySchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("value"),
		key: z.string(),
		value: z.string(),
	}),
	z.object({
		kind: z.literal("secret"),
		key: z.string(),
		set: z.boolean(),
	}),
	z.object({
		kind: z.literal("unset"),
		key: z.string(),
	}),
]);

export const instanceVersionsSchema = z.object({
	app: z.string(),
	postgres: z.string().nullable(),
	qdrant: z.string().nullable(),
	valkey: z.string().nullable(),
	migration: z
		.object({
			name: z.string(),
			appliedAt: z.coerce.date().nullable(),
		})
		.nullable(),
});

export const instanceHealthSchema = z.object({
	checks: z.array(instanceCheckSchema),
	versions: instanceVersionsSchema,
	processes: z.array(instanceProcessSchema),
	queues: z.array(instanceQueueSchema),
	/** Null when the outbox could not be read. */
	mail: instanceMailSchema.nullable(),
	config: z.array(configEntrySchema),
	checkedAt: z.coerce.date(),
});

export type InstanceCheckId = z.infer<typeof instanceCheckIdSchema>;
export type InstanceCheck = z.infer<typeof instanceCheckSchema>;
export type EmailDeliveryChannel = z.infer<typeof emailDeliveryChannelSchema>;
export type InstanceProcess = z.infer<typeof instanceProcessSchema>;
export type InstanceQueue = z.infer<typeof instanceQueueSchema>;
export type InstanceMail = z.infer<typeof instanceMailSchema>;
export type ConfigEntry = z.infer<typeof configEntrySchema>;
export type InstanceVersions = z.infer<typeof instanceVersionsSchema>;
export type InstanceHealth = z.infer<typeof instanceHealthSchema>;
