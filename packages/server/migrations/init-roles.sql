-- Create application roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'opo_app') THEN
    CREATE ROLE opo_app WITH LOGIN PASSWORD 'opo_app_password';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE opo TO opo_app;
