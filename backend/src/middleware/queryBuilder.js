/**
 * Query builder middleware for pagination, search, sort, and filtering.
 * Usage: queryBuilder({ table: 'workflows', searchable: ['name', 'description'], filterable: ['status', 'trigger_type'] })
 */
const queryBuilder = ({ table, searchable = [], filterable = [], defaultSort = 'id' }) => {
  return (req, res, next) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const sortField = req.query.sort || defaultSort;
    const sortOrder = (req.query.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Search across searchable columns with ILIKE
    if (search && searchable.length > 0) {
      const searchConditions = searchable.map(col => {
        params.push(`%${search}%`);
        return `${col}::text ILIKE $${paramIndex++}`;
      });
      conditions.push(`(${searchConditions.join(' OR ')})`);
    }

    // Exact-match filters
    filterable.forEach(col => {
      if (req.query[col] && req.query[col] !== '') {
        params.push(req.query[col]);
        conditions.push(`${col} = $${paramIndex++}`);
      }
    });

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort field: only allow alphanumeric and underscores
    const safeSortField = /^[a-zA-Z_]+$/.test(sortField) ? sortField : defaultSort;

    req.queryOptions = {
      table,
      whereClause,
      params,
      sortField: safeSortField,
      sortOrder,
      limit,
      offset,
      page,
      paramIndex
    };

    next();
  };
};

module.exports = queryBuilder;
