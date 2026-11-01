import type { BlockWithCapabilities } from "@orcai/schema";
import { CompactBlockTile } from "@/components/blocks/block-tile";
import {
	Section,
	SectionDescription,
	SectionGrid,
	SectionHeader,
	SectionTitle,
} from "@/components/ui/shell/section";
import { m } from "@/paraglide/messages";

const BotBlocks = ({ blocks }: { blocks: BlockWithCapabilities[] }) => {
	const behaviour = blocks.find((b) => b.type === "behaviour");
	const repositories = blocks.filter((b) => b.type === "repository");

	return (
		<>
			{behaviour && (
				<Section>
					<SectionHeader>
						<SectionTitle>{m.bots_blocks_behaviour_title()}</SectionTitle>
						<SectionDescription>
							{m.bots_blocks_behaviour_description()}
						</SectionDescription>
					</SectionHeader>
					<CompactBlockTile block={behaviour} />
				</Section>
			)}
			{repositories.length > 0 && (
				<Section>
					<SectionHeader>
						<SectionTitle>{m.bots_blocks_repositories_title()}</SectionTitle>
						<SectionDescription>
							{m.bots_blocks_repositories_description()}
						</SectionDescription>
					</SectionHeader>
					<SectionGrid>
						{repositories.map((block) => (
							<CompactBlockTile key={block.id} block={block} />
						))}
					</SectionGrid>
				</Section>
			)}
		</>
	);
};

export { BotBlocks };
