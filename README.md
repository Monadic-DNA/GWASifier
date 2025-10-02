# GWASifier

Match your DNA data against an open ended catalogue of DNA traits

## Development

### Preparing local data

Fetch the latest GWAS Catalog data from https://www.ebi.ac.uk/gwas/api/search/downloads/alternative into the `localdata` directory. This is "All associations v1.0.2 - with added ontology annotations, GWAS Catalog study accession numbers and genotyping technology" from https://www.ebi.ac.uk/gwas/docs/file-downloads.

Create a new SQLite database at `localdata/gwas_catalog.sqlite`.

Load the contents of the TSV file into the SQLite database using your favorite method.

### Running the GWAS Catalog Explorer

The repository now includes a Next.js single-page application for exploring studies stored in `localdata/gwas_catalog.sqlite`.

```bash
npm install
npm run dev
```

The development server defaults to http://localhost:3000. You can override the database location by exporting `GWAS_DB_PATH` before starting the server.

## Production Deployment

### Using PostgreSQL in Production

For production deployments, you can use a remote PostgreSQL database instead of the local SQLite database:

1. **Set up your PostgreSQL database** with the GWAS catalog data
2. **Set the `POSTGRES_DB` environment variable** to your PostgreSQL connection string:

```bash
export POSTGRES_DB="postgresql://username:password@host:port/database"
# or for production with SSL:
export POSTGRES_DB="postgresql://username:password@host:port/database?sslmode=require"
```

3. **Build and start the application**:

```bash
npm run build
npm start
```

### Environment Variables

- `POSTGRES_DB`: PostgreSQL connection string (if set, takes precedence over SQLite)
- `GWAS_DB_PATH`: Path to SQLite database file (only used if `POSTGRES_DB` is not set)

### Database Schema

The application expects a table named `gwas_catalog` with the standard GWAS Catalog schema. The PostgreSQL version should mirror the SQLite schema structure.

### Performance Optimization

For optimal performance with large GWAS datasets, apply the provided database indexes:

```bash
# For SQLite
sqlite3 /path/to/gwas_catalog.sqlite < sql/sqlite_indexes.sql

# For PostgreSQL
psql $POSTGRES_DB < sql/postgresql_indexes.sql
```

These indexes can improve query performance by 10-100x for search operations. See `sql/README.md` for detailed instructions.

## Citations

Cerezo M, Sollis E, Ji Y, Lewis E, Abid A, Bircan KO, Hall P, Hayhurst J, John S, Mosaku A, Ramachandran S, Foreman A, Ibrahim A, McLaughlin J, Pendlington Z, Stefancsik R, Lambert SA, McMahon A, Morales J, Keane T, Inouye M, Parkinson H, Harris LW.
doi.org/10.1093/nar/gkae1070
Nucleic Acids Research, Volume 53, Issue D1, 6 January 2025, Pages D998–D1005
