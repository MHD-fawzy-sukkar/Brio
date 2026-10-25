ALTER TABLE competition_identities ADD COLUMN design_locked INTEGER NOT NULL DEFAULT 0 CHECK (design_locked IN (0,1));
ALTER TABLE identity_assets ADD COLUMN design_locked INTEGER NOT NULL DEFAULT 0 CHECK (design_locked IN (0,1));
-- Earlier public copies retained the original Cloudinary creator namespace.
-- Only lock references with a recognizable namespace belonging to another creator.
UPDATE identity_assets SET design_locked=1
WHERE source_url LIKE '%/brio/%/identities/%'
  AND instr(source_url, '/brio/' || creator_id || '/identities/')=0;
UPDATE competition_identities SET design_locked=1,visibility='private'
WHERE EXISTS (
  SELECT 1 FROM json_each(competition_identities.input_json, '$.images') image
  JOIN identity_assets asset ON asset.id=json_extract(image.value,'$.mediaId')
  WHERE asset.creator_id=competition_identities.creator_id AND asset.design_locked=1
);
