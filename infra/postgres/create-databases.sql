-- Creates the four databases from WORKSPACE_AND_PACKAGE_STRATEGY.md and
-- enables pgvector on aca_ai. Safe to re-run: `pnpm infra:init` calls this
-- directly in addition to it running automatically on first container init
-- (mounted at /docker-entrypoint-initdb.d).
SELECT 'CREATE DATABASE aca_api'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aca_api')\gexec

SELECT 'CREATE DATABASE aca_indexer'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aca_indexer')\gexec

SELECT 'CREATE DATABASE aca_ai'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aca_ai')\gexec

SELECT 'CREATE DATABASE aca_queue'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'aca_queue')\gexec

\connect aca_ai
CREATE EXTENSION IF NOT EXISTS vector;
