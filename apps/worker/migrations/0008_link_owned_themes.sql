-- Preserve explicit lineage for owned reusable themes. Public third-party copies stay frozen.
ALTER TABLE competition_identities ADD COLUMN source_theme_id TEXT REFERENCES competition_identities(id);
CREATE INDEX idx_identity_theme_source ON competition_identities(creator_id, source_theme_id);

-- Recover unchanged copies only when there is one unambiguous earlier source.
-- Compare artwork, labels and roles, never just the display name.
WITH candidates AS (
  SELECT copy.id AS copy_id, template.id AS template_id, template.updated_at
  FROM competition_identities copy JOIN competition_identities template
    ON template.creator_id=copy.creator_id AND template.id!=copy.id
    AND template.archived_at IS NULL AND template.library_hidden=0 AND template.design_locked=0
    AND template.updated_at<copy.updated_at
  WHERE copy.archived_at IS NULL AND copy.design_locked=0
    AND json_remove(copy.identity_json,'$.avatars')=json_remove(template.identity_json,'$.avatars')
    AND json_array_length(copy.input_json,'$.images')=json_array_length(template.input_json,'$.images')
    AND NOT EXISTS (
      SELECT 1 FROM json_each(copy.input_json,'$.images') image
      LEFT JOIN json_each(template.input_json,'$.images') original ON original.key=image.key
      LEFT JOIN identity_assets asset ON asset.id=json_extract(image.value,'$.mediaId')
      LEFT JOIN identity_assets original_asset ON original_asset.id=json_extract(original.value,'$.mediaId')
      WHERE original.key IS NULL OR asset.source_url IS NULL OR original_asset.source_url IS NULL
        OR asset.id=original_asset.id OR asset.source_url!=original_asset.source_url
        OR json_extract(image.value,'$.label') IS NOT json_extract(original.value,'$.label')
        OR json_extract(image.value,'$.roles') IS NOT json_extract(original.value,'$.roles')
    )
), roots AS (
  SELECT candidate.* FROM candidates candidate
  WHERE NOT EXISTS (SELECT 1 FROM candidates older WHERE older.copy_id=candidate.copy_id AND older.updated_at<candidate.updated_at)
), unambiguous AS (
  SELECT copy_id,MIN(template_id) AS template_id FROM roots GROUP BY copy_id HAVING COUNT(*)=1
)
UPDATE competition_identities SET source_theme_id=(SELECT template_id FROM unambiguous WHERE copy_id=competition_identities.id),library_hidden=1
WHERE id IN (SELECT copy_id FROM unambiguous);
