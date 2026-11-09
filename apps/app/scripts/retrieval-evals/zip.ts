import { crc32, deflateRawSync } from "node:zlib";

/** A zip archive of `files`, deflated, as Office documents are packaged. */
export const zip = (files: Record<string, string | Uint8Array>) => {
	const local: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const [name, content] of Object.entries(files)) {
		const data = typeof content === "string" ? Buffer.from(content) : content;
		const packed = deflateRawSync(data);
		const path = Buffer.from(name);
		const checksum = crc32(data);
		const fields = (header: Buffer, at: number) => {
			header.writeUInt16LE(20, at);
			header.writeUInt16LE(0x0800, at + 2);
			header.writeUInt16LE(8, at + 4);
			header.writeUInt32LE(0, at + 6);
			header.writeUInt32LE(checksum, at + 10);
			header.writeUInt32LE(packed.length, at + 14);
			header.writeUInt32LE(data.length, at + 18);
			header.writeUInt16LE(path.length, at + 22);
		};
		const head = Buffer.alloc(30);
		head.writeUInt32LE(0x04034b50, 0);
		fields(head, 4);
		local.push(head, path, packed);
		const entry = Buffer.alloc(46);
		entry.writeUInt32LE(0x02014b50, 0);
		entry.writeUInt16LE(20, 4);
		fields(entry, 6);
		entry.writeUInt32LE(offset, 42);
		central.push(entry, path);
		offset += head.length + path.length + packed.length;
	}
	const directory = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(Object.keys(files).length, 8);
	end.writeUInt16LE(Object.keys(files).length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);
	return new Uint8Array(
		Buffer.concat([
			...local,
			directory,
			end,
		]),
	);
};
