import type { BlockWithCapabilities } from "@orcai/schema";
import { BlockCard } from "@/components/blocks/block-card";
import {
	Section,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";

const BotBlocks = ({ blocks }: { blocks: BlockWithCapabilities[] }) => {
	const templateBlock = blocks.find((b) => b.type === "template");
	const databaseBlocks = blocks.filter((b) => b.type === "database");

	return (
		<>
			{templateBlock && (
				<Section>
					<SectionHeader>
						<SectionTitle>Behaviour</SectionTitle>
						<SectionDescription>
							This Bot uses a template block to define its behaviour.
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
						<SectionTitle>Repositories</SectionTitle>
						<SectionDescription>
							This Bot uses repository blocks to reference curated content.
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
