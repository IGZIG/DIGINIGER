"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Journal d'audit — une seule porte d'écriture.
 * `audit_logs` n'est lisible par aucun client (RLS) : seules les actions
 * serveur y écrivent, avec la clé de service. On n'échoue jamais une action
 * métier parce que le journal a raté, mais on renvoie l'erreur à l'appelant
 * pour qu'elle soit visible dans les logs serveur.
 */
export async function logAudit(params: {
  actorId: string;
  actorRole?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  /** Motif lisible, affiché dans le journal d'audit (facultatif). */
  note?: string;
}): Promise<{ logged: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor_id: params.actorId,
      actor_role: params.actorRole ?? "admin",
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      metadata: params.note
        ? { ...(params.metadata ?? {}), note: params.note }
        : (params.metadata ?? {}),
    });
    if (error) return { logged: false, error: error.message };
    return { logged: true };
  } catch (error) {
    return { logged: false, error: error instanceof Error ? error.message : "UNKNOWN" };
  }
}
