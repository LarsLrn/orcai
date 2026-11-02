import type { AssetId, BlockId } from "@orcai/core";
import { Client } from "pg";

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

/**
 * Marks the asset prepared and its repository link failed in the active
 * embedding generation for a missing stored extraction, as re-embedding an
 * asset prepared before image descriptions leaves it. Without workers, e2e
 * cannot get there otherwise. Returns the undo, which restores both rows.
 */
export const failWithMissingExtraction = async (link: {
	assetId: AssetId;
	blockId: BlockId;
}) => {
	const client = await connect();
	try {
		await client.query("begin");
		const {
			rows: [asset],
		} = await client.query(
			"select processing_status from asset where id = $1 for update",
			[
				link.assetId,
			],
		);
		const {
			rows: [indexing],
		} = await client.query(
			"select index_status, index_failure, embedding_generation from block_asset where asset_id = $1 and block_id = $2 for update",
			[
				link.assetId,
				link.blockId,
			],
		);
		await client.query(
			"update asset set processing_status = 'completed' where id = $1",
			[
				link.assetId,
			],
		);
		await client.query(
			"update block_asset set index_status = 'failed', index_failure = 'missing_extraction', embedding_generation = (select embedding_generation from instance_settings) where asset_id = $1 and block_id = $2",
			[
				link.assetId,
				link.blockId,
			],
		);
		await client.query("commit");

		return async () => {
			const undo = await connect();
			try {
				await undo.query(
					"update asset set processing_status = $2 where id = $1",
					[
						link.assetId,
						asset.processing_status,
					],
				);
				await undo.query(
					"update block_asset set index_status = $3, index_failure = $4, embedding_generation = $5 where asset_id = $1 and block_id = $2",
					[
						link.assetId,
						link.blockId,
						indexing.index_status,
						indexing.index_failure,
						indexing.embedding_generation,
					],
				);
			} finally {
				await undo.end();
			}
		};
	} finally {
		await client.end();
	}
};
