-- Structure-type levels (owner feedback of 27 Nov 2026): data only, no schema change.
-- site_types.sort_order becomes the level, dense from 0 in each organisation. Level 0 is the root type: the one named
-- 'Filial' (else the current first type). It stays active because it cannot be deactivated any more.
WITH root AS (
  SELECT DISTINCT ON (tenant_id) tenant_id, id FROM "site_types"
  ORDER BY tenant_id, (name = 'Filial') DESC, sort_order, created_at, id
), levels AS (
  SELECT st.id,
    row_number() OVER (PARTITION BY st.tenant_id ORDER BY (st.id = r.id) DESC, st.sort_order, st.created_at, st.id) - 1 AS level
  FROM "site_types" st JOIN root r ON r.tenant_id = st.tenant_id
)
UPDATE "site_types" st SET "sort_order" = levels.level, "active" = st.active OR levels.level = 0
FROM levels WHERE levels.id = st.id;
