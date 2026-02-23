-- Add catalog-catalog association types for vendor→product and product→technology relationships
INSERT INTO association_types (id, name, applies_to, is_directional, inverse_id, is_system, sort_order) VALUES
  ('makes',            'Makes',           'catalog_catalog', true,  'made_by',           true, 10),
  ('made_by',          'Made By',         'catalog_catalog', true,  'makes',             true, 11),
  ('uses_technology',  'Uses Technology', 'catalog_catalog', true,  'used_by_product',   true, 12),
  ('used_by_product',  'Used By Product', 'catalog_catalog', true,  'uses_technology',   true, 13)
ON CONFLICT (id) DO NOTHING;
