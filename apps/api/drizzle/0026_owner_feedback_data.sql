-- Owner feedback of 14 Nov 2026: data only, no schema change.

-- 1. Inbox rows keep the title rendered at send time. Rewrite the Azerbaijani titles sent before the
--    "checklist" → "yoxlama" wording change (87c72de) so the inbox no longer shows "Checklist".
UPDATE "notifications" SET "title" = CASE "title"
  WHEN 'Yeni checklist təyin edildi' THEN 'Yeni yoxlama təyin edildi'
  WHEN 'Checklist başladı' THEN 'Yoxlama başladı'
  WHEN 'Checklistin vaxtı yaxınlaşır' THEN 'Yoxlamanın vaxtı yaxınlaşır'
  WHEN 'Checklist gecikir' THEN 'Yoxlama gecikir'
  WHEN 'Checklist icra olunmadı' THEN 'Yoxlama keçirilmədi'
  ELSE "title" END
WHERE "title" IN ('Yeni checklist təyin edildi', 'Checklist başladı', 'Checklistin vaxtı yaxınlaşır', 'Checklist gecikir', 'Checklist icra olunmadı');
--> statement-breakpoint

-- 2. Every organisation starts with one branch (Filial). Give one to each organisation that has no
--    top-level site yet, named after the organisation, of its "Filial" type (or its first type).
INSERT INTO "sites" ("id", "tenant_id", "parent_id", "type_id", "name", "path")
SELECT s.id, s.tenant_id, NULL, s.type_id, s.name, replace(s.id::text, '-', '')::ltree
FROM (
  SELECT gen_random_uuid() AS id, t.id AS tenant_id, t.name AS name,
    (SELECT st.id FROM "site_types" st WHERE st.tenant_id = t.id
      ORDER BY (st.name = 'Filial') DESC, st.active DESC, st.sort_order, st.created_at LIMIT 1) AS type_id
  FROM "tenants" t
  WHERE NOT EXISTS (SELECT 1 FROM "sites" x WHERE x.tenant_id = t.id AND x.parent_id IS NULL)
) s
WHERE s.type_id IS NOT NULL;
