-- Widen lsad column to accommodate county type names (e.g. "Census Area", "City and Borough")
ALTER TABLE places ALTER COLUMN lsad TYPE VARCHAR(50);
