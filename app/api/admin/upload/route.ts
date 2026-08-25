import { createPublicSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase";
import { createAmbassadorAssetPath, validateUploadFile, validateUploadScope } from "@/lib/upload-validation";

const BUCKET = "ambassador-assets";

type ErrorStatus = 400 | 401 | 403 | 413 | 415 | 500;

function errorResponse(error: string, code: string, status: ErrorStatus) {
  return Response.json({ ok: false, error, code }, { status });
}

function developmentError(code: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    const details = error instanceof Error
      ? { name: error.name, message: error.message }
      : error && typeof error === "object"
        ? error
        : { message: String(error) };
    console.error(`[admin/upload] ${code}`, details);
  }
}

async function authenticateAdmin(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return errorResponse("Sua sessão expirou. Entre novamente.", "SESSION_REQUIRED", 401);
  const authClient = createPublicSupabaseClient();
  if (!authClient) return errorResponse("Serviço de autenticação indisponível.", "AUTH_UNAVAILABLE", 500);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return errorResponse("Sua sessão expirou. Entre novamente.", "SESSION_INVALID", 401);
  if (data.user.app_metadata?.role !== "admin") return errorResponse("Você não tem permissão para enviar imagens.", "ADMIN_REQUIRED", 403);
  return null;
}

export async function POST(request: Request) {
  try {
    const authError = await authenticateAdmin(request);
    if (authError) return authError;

    let form: FormData;
    try {
      form = await request.formData();
    } catch (error) {
      developmentError("INVALID_MULTIPART", error);
      return errorResponse("Não foi possível ler o arquivo enviado.", "INVALID_MULTIPART", 400);
    }

    const file = form.get("file");
    const validation = await validateUploadFile(file);
    if (!validation.ok) return errorResponse(validation.error, validation.code, validation.status);
    const requestedKind = String(form.get("kind") ?? "");
    const requestedId = String(form.get("ambassadorId") ?? "");
    const scope = validateUploadScope(requestedKind, requestedId);
    if (!scope.ok) return errorResponse(scope.error, scope.code, 400);

    const client = createServiceSupabaseClient();
    if (!client) return errorResponse("Serviço de armazenamento indisponível.", "STORAGE_UNAVAILABLE", 500);
    const path = createAmbassadorAssetPath(scope.scope, scope.kind, validation.extension);
    const { error } = await client.storage.from(BUCKET).upload(path, file as File, { contentType: validation.mime, upsert: false });
    if (error) {
      developmentError("STORAGE_UPLOAD_FAILED", { name: error.name, message: error.message, statusCode: error.statusCode });
      return errorResponse("Não foi possível armazenar a imagem.", "STORAGE_UPLOAD_FAILED", 500);
    }
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    return Response.json({ ok: true, url: data.publicUrl, path });
  } catch (error) {
    developmentError("INTERNAL_ERROR", error);
    return errorResponse("Não foi possível concluir o upload.", "INTERNAL_ERROR", 500);
  }
}
