export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
export const UPLOAD_KINDS = new Set(["primary", "secondary", "og"]);

const allowedExtensions: Record<string, Set<string>> = {
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/png": new Set(["png"]),
  "image/webp": new Set(["webp"]),
};

type UploadFailure = { ok: false; error: string; code: string; status: 400 | 413 | 415 };
type UploadSuccess = { ok: true; mime: string; extension: string };

async function detectImageType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return "image/webp";
  return null;
}

export async function validateUploadFile(value: FormDataEntryValue | null): Promise<UploadFailure | UploadSuccess> {
  if (!(value instanceof File) || value.size === 0) return { ok: false, error: "Selecione uma imagem para enviar.", code: "FILE_REQUIRED", status: 400 };
  if (value.size > MAX_UPLOAD_SIZE) return { ok: false, error: "A imagem deve ter no máximo 5 MB.", code: "FILE_TOO_LARGE", status: 413 };
  if (!value.name || value.name.length > 255 || /[\\/\0]/.test(value.name)) return { ok: false, error: "O nome do arquivo é inválido.", code: "INVALID_FILE_NAME", status: 400 };

  const detectedMime = await detectImageType(value);
  const declaredMime = value.type.toLowerCase();
  const extension = value.name.split(".").pop()?.toLowerCase() ?? "";
  if (!detectedMime || !allowedExtensions[detectedMime] || declaredMime !== detectedMime) {
    return { ok: false, error: "Envie uma imagem JPEG, PNG ou WebP válida.", code: "UNSUPPORTED_MEDIA_TYPE", status: 415 };
  }
  if (!allowedExtensions[detectedMime].has(extension)) {
    return { ok: false, error: "A extensão do arquivo não corresponde ao formato da imagem.", code: "EXTENSION_MISMATCH", status: 415 };
  }
  return { ok: true, mime: detectedMime, extension: detectedMime === "image/jpeg" ? "jpg" : extension };
}

export function validateUploadScope(kind: string, ambassadorId: string) {
  if (!UPLOAD_KINDS.has(kind)) return { ok: false as const, error: "O tipo da imagem é inválido.", code: "INVALID_IMAGE_KIND" };
  if (ambassadorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ambassadorId)) {
    return { ok: false as const, error: "O identificador do embaixador é inválido.", code: "INVALID_AMBASSADOR_ID" };
  }
  return { ok: true as const, kind, scope: ambassadorId || `draft-${crypto.randomUUID()}` };
}

export function createAmbassadorAssetPath(scope: string, kind: string, extension: string) {
  return `ambassadors/${scope}/${kind}-${crypto.randomUUID()}.${extension}`;
}
