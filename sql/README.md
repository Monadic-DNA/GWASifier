# Database Index Optimization for GWASifier

This directory contains SQL files to optimize database performance for the GWAS Catalog data used by GWASifier.

## Files

- `sqlite_indexes.sql` - Indexes optimized for SQLite databases
- `postgresql_indexes.sql` - Indexes optimized for PostgreSQL databases

## Performance Impact

These indexes are designed to optimize the most common query patterns in GWASifier:

1. **Text searches** across studies, traits, authors, and genes
2. **P-value filtering** for statistical significance
3. **Sample size filtering** for study quality
4. **SNP lookups** for personal genotype analysis
5. **Trait enumeration** for the traits dropdown
6. **Sorting** by various criteria

Expected performance improvements:
- **Search queries**: 10-100x faster
- **Filtering operations**: 5-50x faster
- **Trait loading**: 2-10x faster
- **Personal genotype analysis**: 5-20x faster

## Usage Instructions

### For SQLite

```bash
# Apply indexes to your SQLite database
sqlite3 /path/to/gwas_catalog.sqlite < sql/sqlite_indexes.sql

# Optional: Analyze the database for optimal query planning
sqlite3 /path/to/gwas_catalog.sqlite "ANALYZE;"
```

### For PostgreSQL

```bash
# Apply indexes to your PostgreSQL database
psql postgresql://user:password@host:port/database < sql/postgresql_indexes.sql

# Update statistics for optimal query planning
psql postgresql://user:password@host:port/database -c "VACUUM ANALYZE gwas_catalog;"
```

## Important Notes

### Timing
- **Run indexes AFTER loading your data** - This is much more efficient than creating indexes first
- **Allow time for creation** - Index creation can take several minutes to hours depending on data size

### Space Requirements
- Indexes will increase database size by approximately **30-50%**
- For a 1GB GWAS catalog, expect indexes to add 300-500MB

### PostgreSQL-Specific Features

The PostgreSQL indexes use advanced features for better performance:

- **CONCURRENT creation** - Database remains available during index creation
- **Partial indexes** - Only index relevant rows to save space
- **GIN indexes** - Optimized for full-text search
- **Text pattern operators** - Optimized for LIKE queries
- **Covering indexes** - Include frequently accessed columns

### Maintenance

#### SQLite
```sql
-- Periodically update statistics
ANALYZE gwas_catalog;

-- Rebuild indexes if needed
REINDEX gwas_catalog;
```

#### PostgreSQL
```sql
-- Update statistics (run weekly)
VACUUM ANALYZE gwas_catalog;

-- Monitor index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'gwas_catalog'
ORDER BY idx_scan DESC;
```

## Performance Monitoring

### Before and After Comparison

To measure the impact of these indexes:

1. **Record baseline performance**:
   ```bash
   # Time a complex search query
   time curl "http://localhost:3000/api/studies?search=diabetes&limit=100"
   ```

2. **Apply indexes using the appropriate SQL file**

3. **Measure improved performance**:
   ```bash
   # Same query should be significantly faster
   time curl "http://localhost:3000/api/studies?search=diabetes&limit=100"
   ```

### Query Examples That Benefit Most

These queries will see the biggest performance improvements:

```bash
# Text search across multiple fields
/api/studies?search=cardiovascular&limit=100

# P-value filtering
/api/studies?maxPValue=5e-8&limit=100

# Trait-specific queries
/api/studies?trait=type%202%20diabetes&limit=100

# Large sample size studies
/api/studies?minSampleSize=10000&limit=100

# Complex combinations
/api/studies?search=height&maxPValue=1e-10&minSampleSize=5000&limit=100
```

## Troubleshooting

### SQLite Issues
- If indexes fail to create, check disk space and SQLite version (3.8.0+ recommended)
- Use `.schema` command to verify indexes were created

### PostgreSQL Issues
- If CONCURRENT creation fails, try without CONCURRENT
- Check `pg_stat_activity` for blocking queries during index creation
- Ensure sufficient `maintenance_work_mem` for large index creation

### Performance Not Improved
- Run `ANALYZE` or `VACUUM ANALYZE` to update query planner statistics
- Check that your queries are using the indexes with `EXPLAIN QUERY PLAN` (SQLite) or `EXPLAIN ANALYZE` (PostgreSQL)
- Consider increasing cache settings for your database configuration