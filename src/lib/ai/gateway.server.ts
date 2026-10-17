import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import type { z } from "zod";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server.ts";

export class ErroIA extends Error {
  constructor(public status: number, message: string, public providerDenied = false) { super(message); }
}

export async function gerarObjetoIA<T>(schema: z.ZodType<T>, system: string, messages: ModelMessage[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new ErroIA(401, "A inteligência artificial ainda não está configurada.");
  const request = getRequest();
  const run = createLovableAiGatewayRunIdFetch(request.headers.get("X-Lovable-AIG-Run-ID") ?? undefined);
  const provider = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" }, fetch: run.fetch });
  try {
    const result = streamText({ model: provider.responses("openai/gpt-6-astra"), system, messages,
      output: Output.object({ schema }), maxRetries: 0, abortSignal: request.signal,
      providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
    });
    const value = await result.output;
    const runId = run.getRunId();
    if (runId) setResponseHeader("X-Lovable-AIG-Run-ID", runId);
    return value;
  } catch (e) {
    if (APICallError.isInstance(e)) {
      let message = "A inteligência artificial está indisponível. Tente novamente mais tarde.";
      let type = "";
      try { const b = JSON.parse(e.responseBody ?? "{}"); message = b.message ?? b.error?.message ?? message; type = b.type ?? b.error?.type ?? ""; } catch { /* No safe provider message */ }
      if (e.statusCode === 401) message = "A conexão da inteligência artificial precisa ser configurada novamente.";
      if (e.statusCode === 429) message = "Muitas solicitações de IA. Aguarde antes de tentar novamente.";
      const denied = e.statusCode === 403 && !["credit_limit_reached", "model_requires_retention_consent", "model_vendor_not_enabled", "provider_not_available_in_region"].includes(type);
      throw new ErroIA(e.statusCode ?? 500, message, denied);
    }
    if (NoObjectGeneratedError.isInstance(e)) throw new ErroIA(422, "A IA não conseguiu produzir uma resposta válida. Nenhum dado foi alterado.");
    if (e instanceof Error && e.name === "AbortError") throw new ErroIA(499, "Solicitação cancelada.");
    throw new ErroIA(500, "Não foi possível concluir a análise. Nenhum dado foi alterado.");
  }
}