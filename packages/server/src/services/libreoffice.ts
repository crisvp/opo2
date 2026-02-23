import { env } from "../config/env.js";

export async function convertToPdf(inputBuffer: Buffer, filename: string): Promise<Buffer> {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(inputBuffer)]), filename);

  const response = await fetch(`${env.LIBREOFFICE_SIDECAR_URL}/convert`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(5 * 60_000),
  });

  if (!response.ok) {
    throw new Error(
      `LibreOffice conversion failed: ${response.status} ${response.statusText}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
