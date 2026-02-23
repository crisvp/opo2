-- Create the application user role used by the server at runtime.
-- opo_admin (superuser) is used only for migrations and admin tasks.
CREATE ROLE opo_app WITH LOGIN PASSWORD 'opo_app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE opo TO opo_app;

-- Allow opo_app to create schemas (required by graphile_worker, which creates and
-- manages its own schema at startup via makeWorkerUtils/run).
GRANT CREATE ON DATABASE opo TO opo_app;
