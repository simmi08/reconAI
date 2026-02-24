type TarFile = {
  path: string;
  content: Buffer;
};

function writeString(target: Buffer, value: string, start: number, length: number): void {
  const encoded = Buffer.from(value, "utf8");
  encoded.copy(target, start, 0, Math.min(encoded.length, length));
}

function writeOctal(target: Buffer, value: number, start: number, length: number): void {
  const octal = Math.max(0, Math.floor(value)).toString(8);
  const padded = octal.padStart(length - 1, "0");
  writeString(target, padded, start, length - 1);
  target[start + length - 1] = 0;
}

function splitTarPath(filePath: string): { name: string; prefix: string } {
  if (Buffer.byteLength(filePath, "utf8") <= 100) {
    return { name: filePath, prefix: "" };
  }

  const parts = filePath.split("/");
  for (let i = 1; i < parts.length; i += 1) {
    const prefix = parts.slice(0, i).join("/");
    const name = parts.slice(i).join("/");
    if (Buffer.byteLength(prefix, "utf8") <= 155 && Buffer.byteLength(name, "utf8") <= 100) {
      return { name, prefix };
    }
  }

  throw new Error(`Path too long for tar archive: ${filePath}`);
}

function createHeader(filePath: string, size: number, mtime: number): Buffer {
  const header = Buffer.alloc(512, 0);
  const { name, prefix } = splitTarPath(filePath);

  writeString(header, name, 0, 100);
  writeOctal(header, 0o644, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, size, 124, 12);
  writeOctal(header, mtime, 136, 12);

  header.fill(0x20, 148, 156);
  header[156] = "0".charCodeAt(0);
  writeString(header, "ustar", 257, 6);
  writeString(header, "00", 263, 2);
  writeString(header, prefix, 345, 155);

  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  const checksumText = checksum.toString(8).padStart(6, "0");
  writeString(header, checksumText, 148, 6);
  header[154] = 0;
  header[155] = 0x20;

  return header;
}

export function buildTarArchive(files: TarFile[]): Buffer {
  const chunks: Buffer[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const file of files) {
    const normalizedPath = file.path.replace(/^\/+/, "").replace(/\\/g, "/");
    const header = createHeader(normalizedPath, file.content.length, now);
    chunks.push(header);
    chunks.push(file.content);

    const remainder = file.content.length % 512;
    if (remainder !== 0) {
      chunks.push(Buffer.alloc(512 - remainder, 0));
    }
  }

  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

