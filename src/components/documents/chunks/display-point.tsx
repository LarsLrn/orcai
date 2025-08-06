import { Markdown } from "@/components/chat/markdown";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { QdrantPoint } from "@/types/qdrant";

const DisplayPoint = ({ point }: { point: QdrantPoint }) => {
	return (
		<Card key={point.id}>
			<CardHeader>
				<CardTitle>
					{point.id} | {point.payload.chunk_index + 1} /{" "}
					{point.payload.chunkCount}
				</CardTitle>
				<CardDescription>
					{point.score && <p>Score: {point.score}</p>}
					<p>
						{point.payload.source} | {point.payload.title} |{" "}
						{point.payload.tokens} tokens
					</p>
					<p>
						{point.payload.createdAt}
						{point.payload.depth}
					</p>
					<p>
						{point.payload.text.length} characters |{" "}
						{point.payload.text.split(" ").length} words
					</p>
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Markdown>{point.payload.text}</Markdown>
				{/* {point.payload.source === "image" && (
          <DisplayChunkImage
            imageRef={{
              reference: point.payload.file_reference,
              type: point.payload.file_type,
              bucket: buckets.processed.name,
            }}
          />
        )} */}
			</CardContent>
		</Card>
	);
};

export { DisplayPoint };
