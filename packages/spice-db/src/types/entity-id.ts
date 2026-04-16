import type {
	AssetId,
	BlockId,
	BotId,
	ChatId,
	GroupId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import type { EntityType } from "./entity-type";

export type EntityIdFor<Entity extends EntityType> = {
	asset: AssetId;
	block: BlockId;
	bot: BotId;
	chat: ChatId;
	group: GroupId;
	organization: OrganizationId;
	user: UserId;
}[Entity];

export type SubjectIdFor<Entity extends EntityType> =
	| EntityIdFor<Entity>
	| (Entity extends "user" ? "*" : never);
