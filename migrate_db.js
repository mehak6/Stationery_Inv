require('dotenv').config();
const { Pool } = require('pg');

console.log('🔄 Starting database migration...');

// Create PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
    const client = await pool.connect();
    
    try {
        console.log('🔗 Connected to PostgreSQL database');
        
        // Enable UUID extension (optional, for future use)
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log('✅ UUID extension enabled');
        
        // Create products table
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                purchase_price DECIMAL(10,2) NOT NULL,
                selling_price DECIMAL(10,2) NOT NULL,
                stock INTEGER NOT NULL DEFAULT 0,
                min_stock INTEGER NOT NULL DEFAULT 5,
                total_sold INTEGER NOT NULL DEFAULT 0,
                date_added TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Products table created');
        
        // Create sales table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL,
                product_name VARCHAR(255) NOT NULL,
                quantity INTEGER NOT NULL,
                sale_price DECIMAL(10,2) NOT NULL,
                purchase_price DECIMAL(10,2) NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                profit DECIMAL(10,2) NOT NULL,
                sale_date DATE NOT NULL,
                customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
                created_at TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Sales table created');
        
        // Create indexes for better performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
            'CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)',
            'CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id)',
            'CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock)',
            'CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at)'
        ];
        
        for (const indexQuery of indexes) {
            await client.query(indexQuery);
        }
        console.log('✅ Database indexes created');
        
        // Verify tables exist
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        const tables = tablesResult.rows.map(row => row.table_name);
        console.log('✅ Database tables verified:', tables);
        
        console.log('🚀 Database migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
migrate();