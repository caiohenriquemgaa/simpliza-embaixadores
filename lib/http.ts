export async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const body = await response.text();
  if (!body || !contentType.includes("application/json")) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[http] Resposta não JSON.", { status: response.status, contentType });
    }
    return null;
  }
  try {
    return JSON.parse(body) as T;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[http] JSON inválido.", { status: response.status, error });
    }
    return null;
  }
}
