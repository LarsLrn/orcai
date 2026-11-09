import { deflateSync } from "node:zlib";

/** An image of one colour, as a PDF image stream's bytes. */
export const solidImage = (
	width: number,
	height: number,
	rgb: [
		number,
		number,
		number,
	],
) => {
	const pixels = Buffer.alloc(width * height * 3);
	for (let pixel = 0; pixel < width * height; pixel++)
		pixels.set(rgb, pixel * 3);
	return {
		width,
		height,
		data: deflateSync(pixels),
	};
};

/** A PDF with one page per image, each image its own object, and a line of text on every page. */
export const pdfWithImages = (images: ReturnType<typeof solidImage>[]) => {
	const fontId = 3 + images.length * 3;
	const objects: Buffer[] = [
		Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
		Buffer.from(
			`<< /Type /Pages /Kids [${images.map((_, page) => `${3 + page * 3} 0 R`).join(" ")}] /Count ${images.length} >>`,
		),
		...images.flatMap((image, page) => {
			const id = 3 + page * 3;
			const content = `q ${image.width} 0 0 ${image.height} 50 50 cm /Im0 Do Q BT /F1 12 Tf 50 20 Td (Refunds page ${page + 1}) Tj ET`;
			return [
				Buffer.from(
					`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 400] /Resources << /XObject << /Im0 ${id + 2} 0 R >> /Font << /F1 ${fontId} 0 R >> >> /Contents ${id + 1} 0 R >>`,
				),
				Buffer.from(
					`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
				),
				Buffer.concat([
					Buffer.from(
						`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.data.length} >>\nstream\n`,
					),
					image.data,
					Buffer.from("\nendstream"),
				]),
			];
		}),
		Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
	];

	const parts = [
		Buffer.from("%PDF-1.4\n"),
	];
	const offsets: number[] = [];
	let offset = parts[0].length;
	for (const [index, body] of objects.entries()) {
		offsets.push(offset);
		const part = Buffer.concat([
			Buffer.from(`${index + 1} 0 obj\n`),
			body,
			Buffer.from("\nendobj\n"),
		]);
		parts.push(part);
		offset += part.length;
	}
	parts.push(
		Buffer.from(
			`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
				.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`)
				.join(
					"",
				)}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
		),
	);
	return Buffer.concat(parts);
};
