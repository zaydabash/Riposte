import type { AuditService } from "../ports/audit-service";
import { AuditConfig, AuditState } from "@/lib/mock-audit";

const BACKEND_URL = "http://127.0.0.1:8000";

export class RealAuditAdapter implements AuditService {
  async startAudit(config: AuditConfig, onUpdate: (state: AuditState) => void): Promise<() => void> {
    try {
      // 1. POST /api/v1/audit/start
      const response = await fetch(`${BACKEND_URL}/api/v1/audit/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url: config.targetUrl,
          repo_url: config.repoUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start audit: ${response.statusText}`);
      }

      const { audit_id } = await response.json();

      // 2. Start Polling GET /api/v1/audit/{audit_id}
      const intervalId = setInterval(async () => {
        try {
          const pollRes = await fetch(`${BACKEND_URL}/api/v1/audit/${audit_id}`);
          if (!pollRes.ok) throw new Error("Failed to fetch audit status");
          
          const backendState = await pollRes.json();
          
          // Map backend state to frontend AuditState
          // The backend returns:
          // { audit_id, status, target_url, aries_score, remediation_url, created_at, updated_at }
          // We need to map it back to the AuditState structure expected by the UI.
          
          let uiStatus: AuditState["status"] = "IDLE";
          if (backendState.status === "RUNNING") uiStatus = "RUNNING";
          if (backendState.status === "VULNERABLE") uiStatus = "VULNERABLE";
          if (backendState.status === "SECURE") uiStatus = "SECURE";
          if (backendState.status === "FAILED") uiStatus = "FAILED";

          // Calculate some deterministic step logic since backend doesn't expose pipeline steps directly
          // For now, if we are running, let's keep advancing
          
          const mappedState: Partial<AuditState> = {
            status: uiStatus,
            pplScore: backendState.aries_score ?? 0,
            remediation: backendState.remediation_url ? {
              prUrl: backendState.remediation_url,
              patchSummary: "Generated remediation patch based on ARiES score."
            } : null,
          };

          onUpdate(mappedState as AuditState); // We would merge this with the current state in a real scenario
          
          if (["VULNERABLE", "SECURE", "FAILED"].includes(backendState.status)) {
            clearInterval(intervalId);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 2000);

      return () => clearInterval(intervalId);
    } catch (err) {
      console.error("Failed to start audit:", err);
      return () => {};
    }
  }
}
