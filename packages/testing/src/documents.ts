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

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL =
	"http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const textShape = (
	id: number,
	y: number,
	paragraphs: string[],
	title: boolean,
) =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr>${title ? '<p:ph type="title"/>' : ""}</p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="${y}"/><a:ext cx="8229600" cy="900000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/>${paragraphs.map((text) => `<a:p><a:r><a:rPr lang="en-GB"/><a:t>${text}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp>`;

/** A PowerPoint deck with one slide per entry, each with its title and lines of text. */
export const pptxWithSlides = (
	slides: {
		title: string;
		lines: string[];
	}[],
) => {
	const files: Record<string, string> = {
		"[Content_Types].xml": `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`,
		"_rels/.rels": `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
		"ppt/presentation.xml": `${XML}<p:presentation ${NS}><p:sldIdLst>${slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
		"ppt/_rels/presentation.xml.rels": `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${REL}/slide" Target="slides/slide${index + 1}.xml"/>`).join("")}</Relationships>`,
	};
	for (const [index, slide] of slides.entries()) {
		files[`ppt/slides/slide${index + 1}.xml`] =
			`${XML}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${textShape(
				2,
				300000,
				[
					slide.title,
				],
				true,
			)}${textShape(3, 1300000, slide.lines, false)}</p:spTree></p:cSld></p:sld>`;
		files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] =
			`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
	}
	return Buffer.from(zip(files));
};
