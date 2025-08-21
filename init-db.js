require('dotenv').config();
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
    console.log('🗄️ Initializing PostgreSQL database...');

    const queries = [
        // Create products table
        `CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            purchase_price DECIMAL(10,2) NOT NULL,
            selling_price DECIMAL(10,2) NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            min_stock INTEGER NOT NULL DEFAULT 5,
            total_sold INTEGER NOT NULL DEFAULT 0,
            date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Create sales table
        `CREATE TABLE IF NOT EXISTS sales (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            product_name VARCHAR(255) NOT NULL,
            quantity INTEGER NOT NULL,
            sale_price DECIMAL(10,2) NOT NULL,
            purchase_price DECIMAL(10,2) NOT NULL,
            total DECIMAL(10,2) NOT NULL,
            profit DECIMAL(10,2) NOT NULL,
            sale_date DATE NOT NULL,
            customer_name VARCHAR(255) DEFAULT 'Walk-in Customer',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Create indexes for better performance
        `CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`,
        `CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)`,
        `CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id)`
    ];

    try {
        for (const query of queries) {
            await pool.query(query);
            const tableName = query.includes('products') ? 'products' :
                            query.includes('sales') ? 'sales' : 'index';
            console.log(`✅ ${tableName} created/verified`);
        }

        // Verify tables were created
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('products', 'sales')
        `);

        console.log('✅ Database tables verified:', result.rows.map(t => t.table_name));
        console.log('🚀 Database initialization complete!');

    } catch (error) {
        console.error('❌ Error initializing database:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run initialization
initializeDatabase().then(() => {
    console.log('✅ PostgreSQL database setup completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
});