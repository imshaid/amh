import { queryOptions } from "@tanstack/react-query";

import { unwrap } from "@/lib/data/result";
import { clientEnv } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";

export interface OrganisationRow {
  id: string;
  nameEn: string;
  nameBn: string;
  notes: string;
  active: boolean;
}

export const clientKeys = {
  all: ["clients"] as const,
  organisations: ["clients", "organisations"] as const,
};

export const organisationsQuery = queryOptions({
  queryKey: clientKeys.organisations,
  enabled: clientEnv.ok,
  queryFn: async (): Promise<OrganisationRow[]> => {
    const rows = unwrap(
      await getSupabase()
        .from("organisations")
        .select("id, name_en, name_bn, notes, active")
        .order("name_en"),
    );
    return rows.map((row) => ({
      id: row.id,
      nameEn: row.name_en,
      nameBn: row.name_bn,
      notes: row.notes,
      active: row.active,
    }));
  },
});
