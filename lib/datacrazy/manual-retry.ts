import type { processNextLead } from "./sync.ts";

type ProcessResult = Awaited<ReturnType<typeof processNextLead>>;

export type ManualRetryOutcome = {
  statusCode: number;
  body: {
    ok: boolean;
    status: ProcessResult["status"];
    message?: string;
    error?: string;
    nextRetry?: string;
  };
  persistError?: string;
};

export async function runManualRetry(processor: () => Promise<ProcessResult>): Promise<ManualRetryOutcome> {
  const result = await processor();

  if (result.status === "synced") {
    return {
      statusCode: 200,
      body: { ok: true, status: result.status, message: "Lead sincronizado com o DataCrazy." },
    };
  }

  if (result.status === "failed") {
    const error = result.error ?? "A sincronização falhou e será elegível para nova tentativa.";
    return {
      statusCode: 502,
      body: { ok: false, status: result.status, error, nextRetry: result.nextRetry },
    };
  }

  const errors = {
    disabled: "Integração DataCrazy desativada neste ambiente.",
    misconfigured: result.status === "misconfigured"
      ? result.error
      : "Integração DataCrazy não configurada neste ambiente.",
    "manual-test-skipped": "Este lead não corresponde à allowlist do modo de teste manual.",
    "manual-test-waiting": "O modo de teste manual exige a seleção de um lead.",
    empty: "O lead não pôde ser reservado para processamento.",
  } as const;
  const error = errors[result.status];
  const statusCode = result.status === "disabled" || result.status === "misconfigured" ? 503 : 409;
  return {
    statusCode,
    body: { ok: false, status: result.status, error },
    persistError: error,
  };
}
