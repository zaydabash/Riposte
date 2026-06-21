/**
 * MVP transport: HTTP-polling implementation of {@link AuditService}.
 *
 * - POSTs `/api/v1/audit/start` with a snake_case body, reads `audit_id` from the
 *   returned snapshot, then polls `GET /api/v1/audit/{audit_id}` on an interval.
 * - A single AbortController cancels the in-flight request on `cleanup`; the
 *   interval is cleared too. No fetch logic leaks into hooks/components.
 * - Each snapshot is JSON-parsed fresh per poll (a new immutable object), so the
 *   diff engine compares distinct references.
 */

import type {
  AuditRequestBody,
  HealthResponse,
  RiposteAuditState,
} from "@/lib/backend-types";
import type {
  AuditConfig,
  AuditService,
  AuditSubscription,
} from "@/ports/audit-service";

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

function jsonHeaders(
  authHeaders?: Readonly<Record<string, string>>,
): Record<string, string> {
  return { "Content-Type": "application/json", ...(authHeaders ?? {}) };
}

export class NetworkAuditAdapter implements AuditService {
  startAudit(
    config: AuditConfig,
    onUpdate: (state: RiposteAuditState) => void,
    onError: (err: Error) => void,
  ): AuditSubscription {
    const controller = new AbortController();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const cleanup = (): void => {
      stopped = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      controller.abort();
    };

    const poll = async (auditId: string): Promise<void> => {
      if (stopped) return;
      try {
        const res = await fetch(
          joinUrl(config.apiBaseUrl, `/api/v1/audit/${encodeURIComponent(auditId)}`),
          { method: "GET", headers: jsonHeaders(config.authHeaders), signal: controller.signal },
        );
        if (!res.ok) {
          throw new Error(`Poll failed (${res.status}): ${await safeText(res)}`);
        }
        const snapshot = (await res.json()) as RiposteAuditState;
        if (!stopped) onUpdate(snapshot);
      } catch (err) {
        if (!isAbort(err) && !stopped) onError(toError(err));
      }
    };

    void (async () => {
      try {
        const body: AuditRequestBody = {
          target_name: config.targetName,
          target_endpoint: config.targetEndpoint,
          source_repository: config.sourceRepository,
          interface_type: "web-ui",
          max_payloads: config.maxPayloads,
        };
        const res = await fetch(joinUrl(config.apiBaseUrl, "/api/v1/audit/start"), {
          method: "POST",
          headers: jsonHeaders(config.authHeaders),
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Start failed (${res.status}): ${await safeText(res)}`);
        }
        const initial = (await res.json()) as RiposteAuditState;
        if (stopped) return;
        onUpdate(initial);

        const auditId = initial.audit_id;
        intervalId = setInterval(() => void poll(auditId), config.pollingIntervalMs);
      } catch (err) {
        if (!isAbort(err) && !stopped) onError(toError(err));
      }
    })();

    return { cleanup };
  }

  async fetchHealth(
    apiBaseUrl: string,
    authHeaders?: Readonly<Record<string, string>>,
  ): Promise<HealthResponse> {
    const res = await fetch(joinUrl(apiBaseUrl, "/health"), {
      method: "GET",
      headers: jsonHeaders(authHeaders),
    });
    if (!res.ok) throw new Error(`Health check failed (${res.status})`);
    return (await res.json()) as HealthResponse;
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}
