const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool
const pool = new Pool();

/**
 * Get all tables and their columns from the database
 * @returns {Promise<Array>} Database schema information
 */
async function getDatabaseSchema() {
  // First, let's get detailed information about columns and constraints
  const query = `
    SELECT 
      t.table_name, 
      c.column_name, 
      c.data_type,
      c.is_nullable,
      c.column_default,
      -- Check if column is a primary key
      (
        SELECT COUNT(*)
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = t.table_name 
          AND ccu.column_name = c.column_name
          AND tc.constraint_type = 'PRIMARY KEY'
      ) > 0 AS is_primary_key,
      -- Check if column is a foreign key
      (
        SELECT COUNT(*)
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = t.table_name 
          AND ccu.column_name = c.column_name
          AND tc.constraint_type = 'FOREIGN KEY'
      ) > 0 AS is_foreign_key
    FROM 
      information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
    WHERE 
      t.table_schema = 'public'
    ORDER BY 
      t.table_name, 
      c.ordinal_position;
  `;

  try {
    console.log('Running schema query...');
    const result = await pool.query(query);
    console.log(`Schema query returned ${result.rows.length} rows`);
    
    if (result.rows.length === 0) {
      // If no schema information is found, try to get a list of tables and sample data
      console.log('No schema information found. Trying to get table list...');
      const tableListQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `;
      const tableList = await pool.query(tableListQuery);
      console.log(`Found ${tableList.rows.length} tables: ${tableList.rows.map(r => r.table_name).join(', ')}`);
      
      // For each table, try to get sample data and structure
      for (const table of tableList.rows) {
        const tableName = table.table_name;
        try {
          // Get column information
          console.log(`Getting column info for table: ${tableName}`);
          const columnQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1
          `;
          const columnInfo = await pool.query(columnQuery, [tableName]);
          console.log(`Table ${tableName} has columns: ${columnInfo.rows.map(c => c.column_name).join(', ')}`);
          
          // Get sample data (first row)
          console.log(`Getting sample data for table: ${tableName}`);
          const sampleQuery = `SELECT * FROM "${tableName}" LIMIT 1`;
          const sampleData = await pool.query(sampleQuery);
          if (sampleData.rows.length > 0) {
            console.log(`Sample data for ${tableName}: ${JSON.stringify(sampleData.rows[0])}`);
          } else {
            console.log(`No data in table ${tableName}`);
          }
        } catch (error) {
          console.error(`Error inspecting table ${tableName}:`, error);
        }
      }
    }
    
    // Transform results to a more usable format
    const schema = {};
    result.rows.forEach(row => {
      if (!schema[row.table_name]) {
        schema[row.table_name] = [];
      }
      
      schema[row.table_name].push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
        isPrimaryKey: row.is_primary_key,
        isForeignKey: row.is_foreign_key
      });
    });
    
    // Log summary of each table and its columns
    console.log('\nDetailed schema information:');
    Object.entries(schema).forEach(([tableName, columns]) => {
      console.log(`\nTable: ${tableName}`);
      columns.forEach(col => {
        const keyInfo = col.isPrimaryKey ? 'PRIMARY KEY' : (col.isForeignKey ? 'FOREIGN KEY' : '');
        console.log(`  ${col.name} (${col.type})${keyInfo ? ' [' + keyInfo + ']' : ''}`);
      });
    });
    
    return schema;
  } catch (error) {
    console.error('Error fetching database schema:', error);
    throw error;
  }
}

/**
 * Execute a SQL query against the database
 * @param {string} query - SQL query string
 * @returns {Promise<Object>} Query results
 */
async function executeQuery(query) {
  try {
    const result = await pool.query(query);
    
    // Create a serializable version of the result
    // Only include what's needed (rows, rowCount, fields)
    const serializableResult = {
      rows: result.rows.map(row => {
        // Convert each row to a plain object with primitive values
        const cleanRow = {};
        for (const key in row) {
          // Handle special types that need conversion
          if (row[key] instanceof Date) {
            cleanRow[key] = row[key].toISOString();
          } else if (row[key] instanceof Buffer) {
            cleanRow[key] = row[key].toString('hex');
          } else if (typeof row[key] === 'bigint') {
            cleanRow[key] = row[key].toString();
          } else {
            cleanRow[key] = row[key];
          }
        }
        return cleanRow;
      }),
      rowCount: result.rowCount,
      // Include column names and types
      fields: result.fields ? result.fields.map(field => ({
        name: field.name,
        dataTypeID: field.dataTypeID
      })) : []
    };
    
    return serializableResult;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

/**
 * Test the database connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
  try {
    await pool.query('SELECT NOW()');
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}

module.exports = {
  getDatabaseSchema,
  executeQuery,
  testConnection
}; 