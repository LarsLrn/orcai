import { Markdown } from "@/components/chat/markdown";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { QdrantChunk } from "@/types/qdrant";

const DisplayChunk = ({ chunk }: { chunk: QdrantChunk }) => {
	return (
		<Card key={chunk.id}>
			<CardHeader>
				<CardTitle>
					{chunk.id} | {chunk.payload.chunkIndex + 1} /{" "}
					{chunk.payload.chunkCount}
				</CardTitle>
				<CardDescription>
					{chunk.score && <p>Score: {chunk.score}</p>}
					<p>
						{chunk.payload.source} | {chunk.payload.title} |{" "}
						{chunk.payload.file_reference} | {chunk.payload.file_type} |{" "}
						{chunk.payload.tokens} tokens
					</p>
					<p>
						{chunk.payload.createdAt} | {chunk.payload.document_id} |{" "}
						{chunk.payload.course_id} | {chunk.payload.depth}
					</p>
					<p>
						{chunk.payload.text.length} characters |{" "}
						{chunk.payload.text.split(" ").length} words
					</p>
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Markdown>{chunk.payload.text}</Markdown>
				{/* {chunk.payload.source === "image" && (
          <DisplayChunkImage
            imageRef={{
              reference: chunk.payload.file_reference,
              type: chunk.payload.file_type,
              bucket: buckets.processed.name,
              prefix: chunk.payload.document_id,
            }}
          />
        )} */}
			</CardContent>
		</Card>
	);
};

export { DisplayChunk };
