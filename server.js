require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// ========== CORS CONFIGURATION ==========
const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};

// ========== MIDDLEWARE ==========
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public')); // Serve static files from public directory

// ========== SECURITY HEADERS ==========
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Remove server information disclosure
    res.removeHeader('X-Powered-By');
    next();
});

// ========== DATABASE CONFIGURATION ==========
let pool;
let dbInitialized = false;

// Database connection pool configuration
const dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
};

function connectDatabase() {
    return new Promise((resolve, reject) => {
        try {
            console.log('🔌 Connecting to PostgreSQL database...');
            console.log(`📍 Database: ${process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}`);

            // Create PostgreSQL connection pool with enhanced configuration
            pool = new Pool(dbConfig);

            console.log('✅ Connected to PostgreSQL database');

            // Test the connection
            pool.query('SELECT NOW()', (err, res) => {
                if (err) {
                    console.error('❌ Error testing database connection:', err);
                    reject(err);
                } else {
                    console.log('✅ Database connection test successful');
                    // Check if tables already exist
                    pool.query(`
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = 'public'
                        AND table_name IN ('products', 'sales')
                    `, (err, result) => {
                        if (err) {
                            console.error('❌ Error checking tables:', err);
                            reject(err);
                        } else if (result.rows.length === 2) {
                            console.log('✅ Database tables already exist, skipping initialization');
                            dbInitialized = true;
                            resolve();
                        } else {
                            console.log('🗄️ Tables not found, initializing database...');
                            initializeDatabase()
                                .then(() => {
                                    dbInitialized = true;
                                    resolve();
                                })
                                .catch(reject);
                        }
                    });
                }
            });
        } catch (error) {
            console.error('❌ Error creating database connection:', error);
            reject(error);
        }
    });
}

// Initialize database tables with Promise
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        console.log('🗄️ Initializing database tables...');

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

        let completedOperations = 0;
        const totalOperations = queries.length + 1; // +1 for verification

        function checkCompletion() {
            completedOperations++;
            if (completedOperations === totalOperations) {
                // Verify tables were created
                pool.query(`
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name IN ('products', 'sales')
                `, (err, result) => {
                    if (err) {
                        console.error('❌ Error verifying tables:', err);
                        reject(err);
                    } else {
                        console.log('✅ Database tables verified:', result.rows.map(t => t.table_name));
                        console.log('🚀 Database initialization complete!');
                        resolve();
                    }
                });
            }
        }

        // Execute each query
        queries.forEach((query, index) => {
            pool.query(query, (err, result) => {
                if (err) {
                    console.error(`❌ Error executing query ${index + 1}:`, err);
                    reject(err);
                    return;
                } else {
                    const tableName = query.includes('products') ? 'products' :
                                    query.includes('sales') ? 'sales' : 'index';
                    console.log(`✅ ${tableName} created/verified`);
                }
                checkCompletion();
            });
        });
    });
}

// Middleware to check database initialization
function requireDatabase(req, res, next) {
    if (!dbInitialized) {
        return res.status(503).json({
            error: 'Database not initialized yet. Please wait a moment and try again.'
        });
    }
    next();
}



// ========== API ROUTES ==========

// Get database status
app.get('/api/status', requireDatabase, async (req, res) => {
    try {
        const productResult = await pool.query('SELECT COUNT(*) as product_count FROM products');
        const saleResult = await pool.query('SELECT COUNT(*) as sale_count FROM sales');

        res.json({
            status: 'connected',
            database: 'PostgreSQL',
            products: parseInt(productResult.rows[0].product_count),
            sales: parseInt(saleResult.rows[0].sale_count),
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Error fetching database status:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== PRODUCTS ROUTES ==========

// Get all products
app.get('/api/products', requireDatabase, async (req, res) => {
    console.log('📖 Fetching all products from database...');

    try {
        const result = await pool.query(`
            SELECT id, name, purchase_price, selling_price, stock, min_stock,
                   total_sold, date_added, created_at, updated_at
            FROM products
            ORDER BY created_at DESC
        `);

        console.log(`✅ Fetched ${result.rows.length} products from database`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching products:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add new product
app.post('/api/products', requireDatabase, async (req, res) => {
    console.log('➕ Adding new product to database...');

    const { name, purchase_price, selling_price, stock, min_stock } = req.body;

    // Validate input
    if (!name || purchase_price == null || selling_price == null || stock == null) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (purchase_price < 0 || selling_price < 0 || stock < 0) {
        return res.status(400).json({ error: 'Values cannot be negative' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO products (name, purchase_price, selling_price, stock, min_stock)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [name, purchase_price, selling_price, stock, min_stock || 5]);

        console.log(`✅ Product added to database with ID: ${result.rows[0].id}`);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('❌ Error adding product:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update product stock (used when making sales)
app.put('/api/products/:id/stock', async (req, res) => {
    const { id } = req.params;
    const { stock, total_sold } = req.body;

    try {
        const result = await pool.query(`
            UPDATE products
            SET stock = $1, total_sold = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [stock, total_sold, id]);

        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log(`✅ Product stock updated for ID: ${id}`);
            res.json({ message: 'Stock updated successfully' });
        }
    } catch (err) {
        console.error('❌ Error updating product stock:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;

    console.log(`🗑️ Deleting product with ID: ${id}`);

    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log(`✅ Product deleted from database`);
            res.json({ message: 'Product deleted successfully' });
        }
    } catch (err) {
        console.error('❌ Error deleting product:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== SALES ROUTES ==========

// Get all sales
app.get('/api/sales', async (req, res) => {
    console.log('📖 Fetching all sales from database...');

    try {
        const result = await pool.query(`
            SELECT id, product_id, product_name, quantity, sale_price, purchase_price,
                   total, profit, sale_date, customer_name, created_at
            FROM sales
            ORDER BY created_at DESC
        `);

        console.log(`✅ Fetched ${result.rows.length} sales from database`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Error fetching sales:', err);
        res.status(500).json({ error: err.message });
    }
});

// Record new sale
app.post('/api/sales', async (req, res) => {
    console.log('💰 Recording new sale to database...');

    const { product_id, quantity, sale_date, customer_name } = req.body;

    // Validate input
    if (!product_id || !quantity || !sale_date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await pool.connect();

    try {
        // Start transaction
        await client.query('BEGIN');

        // First, get the product details
        const productResult = await client.query('SELECT * FROM products WHERE id = $1', [product_id]);
        const product = productResult.rows[0];

        if (!product) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product not found' });
        }

        if (product.stock < quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: `Insufficient stock! Available: ${product.stock}`
            });
        }

        // Calculate sale details
        const total = quantity * product.selling_price;
        const profit = quantity * (product.selling_price - product.purchase_price);
        const newStock = product.stock - quantity;
        const newTotalSold = product.total_sold + quantity;

        // Insert sale record
        const saleResult = await client.query(`
            INSERT INTO sales (product_id, product_name, quantity, sale_price,
                             purchase_price, total, profit, sale_date, customer_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [
            product_id, product.name, quantity, product.selling_price,
            product.purchase_price, total, profit, sale_date,
            customer_name || 'Walk-in Customer'
        ]);

        // Update product stock
        await client.query(`
            UPDATE products
            SET stock = $1, total_sold = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [newStock, newTotalSold, product_id]);

        // Commit transaction
        await client.query('COMMIT');

        console.log(`✅ Sale recorded with ID: ${saleResult.rows[0].id}`);
        res.json(saleResult.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error recording sale:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ========== ANALYTICS ROUTES ==========

// Get business analytics
app.get('/api/analytics', async (req, res) => {
    console.log('📊 Generating business analytics...');

    const queries = {
        totalProducts: 'SELECT COUNT(*) as count FROM products',
        totalSales: 'SELECT COALESCE(SUM(total), 0) as total FROM sales',
        totalProfit: 'SELECT COALESCE(SUM(profit), 0) as total FROM sales',
        lowStockItems: 'SELECT COUNT(*) as count FROM products WHERE stock <= min_stock',
        todaySales: `SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE sale_date = CURRENT_DATE`,
        todayProfit: `SELECT COALESCE(SUM(profit), 0) as total FROM sales WHERE sale_date = CURRENT_DATE`,
        weekSales: `SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'`,
        monthSales: `SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE sale_date >= CURRENT_DATE - INTERVAL '30 days'`
    };

    const results = {};

    try {
        for (const [key, query] of Object.entries(queries)) {
            const result = await pool.query(query);
            results[key] = result.rows[0].total !== undefined ? parseFloat(result.rows[0].total) : parseInt(result.rows[0].count);
        }

        console.log('✅ Analytics generated successfully');
        res.json(results);
    } catch (err) {
        console.error('❌ Error in analytics query:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== DATA MANAGEMENT ROUTES ==========

// Export all data
app.get('/api/export', async (req, res) => {
    console.log('📥 Exporting database...');

    try {
        const productsResult = await pool.query('SELECT * FROM products ORDER BY created_at');
        const salesResult = await pool.query('SELECT * FROM sales ORDER BY created_at');

        const exportData = {
            products: productsResult.rows,
            sales: salesResult.rows,
            exportDate: new Date().toISOString(),
            version: '2.0',
            database: 'PostgreSQL'
        };

        console.log(`✅ Database exported: ${productsResult.rows.length} products, ${salesResult.rows.length} sales`);
        res.json(exportData);
    } catch (err) {
        console.error('❌ Error exporting database:', err);
        res.status(500).json({ error: err.message });
    }
});


// Clear all data
app.delete('/api/clear-all', async (req, res) => {
    console.log('🗑️ Clearing all database records...');

    const client = await pool.connect();

    try {
        // Start transaction
        await client.query('BEGIN');

        // Clear sales table
        await client.query('DELETE FROM sales');

        // Clear products table
        await client.query('DELETE FROM products');

        // Reset sequences
        await client.query('ALTER SEQUENCE products_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE sales_id_seq RESTART WITH 1');

        // Commit transaction
        await client.query('COMMIT');

        console.log('✅ All database records cleared');
        res.json({ message: 'All data cleared successfully' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error clearing database:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ========== SERVER STARTUP ==========
async function startServer() {
    try {
        console.log('🔄 Starting Stationery Business Manager...');
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🚪 Port: ${PORT}`);
        console.log(`🏠 Host: ${HOST}`);

        // Connect and initialize database first
        await connectDatabase();

        // Create server with SSL support for production
        let server;
        if (process.env.SSL_ENABLED === 'true') {
            const https = require('https');
            const sslOptions = {
                key: fs.readFileSync(process.env.SSL_KEY_PATH || './ssl/private.key'),
                cert: fs.readFileSync(process.env.SSL_CERT_PATH || './ssl/certificate.crt')
            };
            server = https.createServer(sslOptions, app);
            console.log('🔒 SSL enabled');
        } else {
            server = app;
        }

        // Start the Express server
        server.listen(PORT, HOST, () => {
            const protocol = process.env.SSL_ENABLED === 'true' ? 'https' : 'http';
            console.log(`🚀 Stationery Business Manager Server running on ${protocol}://${HOST}:${PORT}`);
            console.log(`📱 Access the application at: ${protocol}://localhost:${PORT}`);
            console.log(`🗄️ Database: PostgreSQL`);
            console.log(`📡 API endpoints available at: ${protocol}://localhost:${PORT}/api/*`);
            console.log(`✅ Database initialization: ${dbInitialized ? 'Complete' : 'Failed'}`);
            console.log(`🔧 CORS Origins: ${corsOptions.origin.join(', ')}`);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the application
startServer();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        if (pool) {
            await pool.end();
            console.log('✅ Database connection pool closed');
        }
    } catch (err) {
        console.error('❌ Error closing database:', err);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    try {
        if (pool) {
            await pool.end();
        }
    } catch (err) {
        console.error('❌ Error closing database:', err);
    }
    process.exit(0);
});