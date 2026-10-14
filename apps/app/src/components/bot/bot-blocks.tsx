import type { BlockWithCapabilities } from "@orcai/schema";
import { BlockCard } from "@/components/blocks/block-card";
import {
	Section,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { m } from "@/paraglide/messages";

const BotBlocks = ({ blocks }: { blocks: BlockWithCapabilities[] }) => {
	const templateBlock = blocks.find((b) => b.type === "template");
	const databaseBlocks = blocks.filter((b) => b.type === "database");

	return (
		<>
			{templateBlock && (
				<Section>
					<SectionHeader>
						<SectionTitle>{m.bots_blocks_behaviour_title()}</SectionTitle>
						<SectionDescription>
							{m.bots_blocks_behaviour_description()}
						</SectionDescription>
					</SectionHeader>
					<BlockCard
						block={templateBlock}
						actions={{
							footer: [],
						}}
					/>
				</Section>
			)}
			{databaseBlocks.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>{m.bots_blocks_repositories_title()}</SectionTitle>
						<SectionDescription>
							{m.bots_blocks_repositories_description()}
						</SectionDescription>
					</SectionHeader>
					<SectionGrid layout="3">
						{databaseBlocks.map((block) => (
							<BlockCard
								key={block.id}
								block={block}
								actions={{
									footer: [],
								}}
							/>
						))}
					</SectionGrid>
				</Section>
			)}
		</>
	);
};

export { BotBlocks };
