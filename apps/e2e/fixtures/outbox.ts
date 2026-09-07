import { Client } from "pg";

export type OutboxEntry = {
	id: string;
	type: string;
	recipient: string;
	payload: Record<string, unknown>;
	createdAt: Date;
	/** First `http…` string found anywhere in the payload. */
	url: string | undefined;
};

const findUrl = (value: unknown): string | undefined => {
	if (typeof value === "string") {
		return value.startsWith("http") ? value : undefined;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			const url = findUrl(item);
			if (url) {
				return url;
			}
		}
		return undefined;
	}

	if (value !== null && typeof value === "object") {
		for (const item of Object.values(value)) {
			const url = findUrl(item);
			if (url) {
				return url;
			}
		}
	}

	return undefined;
};

const connect = async () => {
	const client = new Client({
		host: process.env.POSTGRES_HOST,
		port: Number(process.env.POSTGRES_PORT),
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
		database: process.env.POSTGRES_DB,
	});

	await client.connect();
	return client;
};

/** Newest notification queued for a recipient; e2e reads links from here instead of mail. */
export const latestFor = async (
	email: string,
	type: string,
): Promise<OutboxEntry | undefined> => {
	const client = await connect();

	try {
		const result = await client.query<{
			id: string;
			type: string;
			recipient: string;
			payload: Record<string, unknown>;
			created_at: Date;
		}>(
			`select id, type, recipient, payload, created_at
			 from notification_outbox
			 where recipient = $1 and type = $2
			 order by created_at desc, id desc
			 limit 1`,
			[
				email,
				type,
			],
		);

		const row = result.rows[0];

		if (!row) {
			return undefined;
		}

		return {
			id: row.id,
			type: row.type,
			recipient: row.recipient,
			payload: row.payload,
			createdAt: row.created_at,
			url: findUrl(row.payload),
		};
	} finally {
		await client.end();
	}
};

export type Outbox = {
	latestFor: typeof latestFor;
};
