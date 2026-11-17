// Slice 137, Part B — open helper for the AI Deal Copilot widget.
//
// CONTRACT (the buttons that call this live in other components —
// DealAnalyzer, the deal desk, the buyer scripts — and must match
// this exactly): dispatching the 'ws:open-copilot' CustomEvent is
// the ONLY open mechanism. There is no other opener, no global
// function, and no prop-drilled setter. The Copilot widget
// (components/AiCopilot.tsx) listens for this event, sets its
// context state, opens its drawer, and — when autoQuestion is
// given — fills the input and sends immediately.

export function openCopilot(contextSummary: string, autoQuestion?: string): void {
  window.dispatchEvent(
    new CustomEvent('ws:open-copilot', {
      detail: { context: contextSummary, autoQuestion: autoQuestion ?? null },
    }),
  );
}

// Read the honest error message out of a failed Edge Function call.
//
// supabase.functions.invoke() reports a non-2xx function response as
// a FunctionsHttpError whose .message is only the generic "Edge
// Function returned a non-2xx status code" — the function's own
// { success: false, error: "..." } body lives on .context (the
// Response). Without this, the 400 not-connected answer ("AI not
// connected — add your own free Gemini or Groq key in My Providers")
// would surface as the generic message instead of the honest one.
// A FunctionsFetchError (function not deployed / network) has no
// .context with a body, so its own message is returned unchanged.
export async function extractEdgeFunctionError(
  fnError: unknown,
): Promise<{ message: string; status?: number }> {
  const err = fnError as { message?: string; context?: unknown } | null;
  const context = err?.context as
    | { status?: number; json?: () => Promise<unknown> }
    | undefined;
  const status = typeof context?.status === 'number' ? context.status : undefined;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (
        body &&
        typeof body === 'object' &&
        typeof (body as { error?: unknown }).error === 'string'
      ) {
        return { message: (body as { error: string }).error, status };
      }
    } catch {
      // Fall through to the generic message below.
    }
  }
  return {
    message:
      typeof err?.message === 'string' && err.message !== ''
        ? err.message
        : 'The Copilot could not be reached.',
    status,
  };
}
