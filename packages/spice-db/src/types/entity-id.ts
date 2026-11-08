import type {
	AssetId,
	AuthzEntityType,
	BlockId,
	BotId,
	ChatId,
	GroupId,
	OrganizationId,
	UserId,
} from "@orcai/core";

export type EntityIdFor<Entity extends AuthzEntityType> = {
	asset: AssetId;
	block: BlockId;
	bot: BotId;
	chat: ChatId;
	group: GroupId;
	organization: OrganizationId;
	user: UserId;
}[Entity];

export type SubjectIdFor<Entity extends AuthzEntityType> =
	| EntityIdFor<Entity>
	| (Entity extends "user" ? "*" : never);
