const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Database setup with proper error handling and wait for initialization
const dbPath = path.join(__dirname, 'stationery_business.db');

let db;
let dbInitialized = false;

function connectDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Error opening database:', err.message);
                reject(err);
            } else {
                console.log('✅ Connected to SQLite database:', dbPath);
                initializeDatabase()
                    .then(() => {
                        dbInitialized = true;
                        resolve();
                    })
                    .catch(reject);
            }
        });
    });
}

// Initialize database tables with Promise
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        console.log('🗄️ Initializing database tables...');
        
        // Use serialize to ensure sequential execution
        db.serialize(() => {
            let completedOperations = 0;
            const totalOperations = 6; // Number of database operations
            
            function checkCompletion() {
                completedOperations++;
                if (completedOperations === totalOperations) {
                    // Verify tables were created
                    db.all(`SELECT name FROM sqlite_master WHERE type='table'`, (err, tables) => {
                        if (err) {
                            console.error('❌ Error verifying tables:', err);
                            reject(err);
                        } else {
                            console.log('✅ Database tables verified:', tables.map(t => t.name));
                            console.log('🚀 Database initialization complete!');
                            resolve();
                        }
                    });
                }
            }

            // Enable foreign keys
            db.run("PRAGMA foreign_keys = ON", (err) => {
                if (err) {
                    console.error('❌ Error enabling foreign keys:', err);
                    reject(err);
                    return;
                } else {
                    console.log('✅ Foreign keys enabled');
                }
                checkCompletion();
            });

            // Create products table first
            db.run(`
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    purchase_price REAL NOT NULL,
                    selling_price REAL NOT NULL,
                    stock INTEGER NOT NULL DEFAULT 0,
                    min_stock INTEGER NOT NULL DEFAULT 5,
                    total_sold INTEGER NOT NULL DEFAULT 0,
                    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('❌ Error creating products table:', err);
                    reject(err);
                    return;
                } else {
                    console.log('✅ Products table created/verified');
                }
                checkCompletion();
            });

            // Create sales table after products table
            db.run(`
                CREATE TABLE IF NOT EXISTS sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    product_name TEXT NOT NULL,
                    quantity INTEGER NOT NULL,
                    sale_price REAL NOT NULL,
                    purchase_price REAL NOT NULL,
                    total REAL NOT NULL,
                    profit REAL NOT NULL,
                    sale_date DATE NOT NULL,
                    customer_name TEXT DEFAULT 'Walk-in Customer',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('❌ Error creating sales table:', err);
                    reject(err);
                    return;
                } else {
                    console.log('✅ Sales table created/verified');
                }
                checkCompletion();
            });

            // Create indexes for better performance
            db.run(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`, (err) => {
                if (err) {
                    console.error('❌ Error creating products index:', err);
                } else {
                    console.log('✅ Products index created');
                }
                checkCompletion();
            });
            
            db.run(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)`, (err) => {
                if (err) {
                    console.error('❌ Error creating sales date index:', err);
                } else {
                    console.log('✅ Sales date index created');
                }
                checkCompletion();
            });
            
            db.run(`CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id)`, (err) => {
                if (err) {
                    console.error('❌ Error creating sales product index:', err);
                } else {
                    console.log('✅ Sales product index created');
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
app.get('/api/status', requireDatabase, (req, res) => {
    db.get(`SELECT COUNT(*) as product_count FROM products`, (err, productResult) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        db.get(`SELECT COUNT(*) as sale_count FROM sales`, (err, saleResult) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            res.json({
                status: 'connected',
                database: 'SQLite',
                products: productResult.product_count,
                sales: saleResult.sale_count,
                timestamp: new Date().toISOString()
            });
        });
    });
});

// ========== PRODUCTS ROUTES ==========

// Get all products
app.get('/api/products', requireDatabase, (req, res) => {
    console.log('📖 Fetching all products from database...');
    
    db.all(`
        SELECT id, name, purchase_price, selling_price, stock, min_stock, 
               total_sold, date_added, created_at, updated_at
        FROM products 
        ORDER BY created_at DESC
    `, (err, rows) => {
        if (err) {
            console.error('❌ Error fetching products:', err);
            res.status(500).json({ error: err.message });
        } else {
            console.log(`✅ Fetched ${rows.length} products from database`);
            res.json(rows);
        }
    });
});

// Add new product
app.post('/api/products', requireDatabase, (req, res) => {
    console.log('➕ Adding new product to database...');
    
    const { name, purchase_price, selling_price, stock, min_stock } = req.body;
    
    // Validate input
    if (!name || purchase_price == null || selling_price == null || stock == null) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (purchase_price < 0 || selling_price < 0 || stock < 0) {
        return res.status(400).json({ error: 'Values cannot be negative' });
    }
    
    db.run(`
        INSERT INTO products (name, purchase_price, selling_price, stock, min_stock)
        VALUES (?, ?, ?, ?, ?)
    `, [name, purchase_price, selling_price, stock, min_stock || 5], function(err) {
        if (err) {
            console.error('❌ Error adding product:', err);
            res.status(500).json({ error: err.message });
        } else {
            console.log(`✅ Product added to database with ID: ${this.lastID}`);
            
            // Return the created product
            db.get(`SELECT * FROM products WHERE id = ?`, [this.lastID], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    res.json(row);
                }
            });
        }
    });
});

// Update product stock (used when making sales)
app.put('/api/products/:id/stock', (req, res) => {
    const { id } = req.params;
    const { stock, total_sold } = req.body;
    
    db.run(`
        UPDATE products 
        SET stock = ?, total_sold = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [stock, total_sold, id], function(err) {
        if (err) {
            console.error('❌ Error updating product stock:', err);
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log(`✅ Product stock updated for ID: ${id}`);
            res.json({ message: 'Stock updated successfully' });
        }
    });
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    
    console.log(`🗑️ Deleting product with ID: ${id}`);
    
    db.run(`DELETE FROM products WHERE id = ?`, [id], function(err) {
        if (err) {
            console.error('❌ Error deleting product:', err);
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Product not found' });
        } else {
            console.log(`✅ Product deleted from database`);
            res.json({ message: 'Product deleted successfully' });
        }
    });
});

// ========== SALES ROUTES ==========

// Get all sales
app.get('/api/sales', (req, res) => {
    console.log('📖 Fetching all sales from database...');
    
    db.all(`
        SELECT id, product_id, product_name, quantity, sale_price, purchase_price,
               total, profit, sale_date, customer_name, created_at
        FROM sales 
        ORDER BY created_at DESC
    `, (err, rows) => {
        if (err) {
            console.error('❌ Error fetching sales:', err);
            res.status(500).json({ error: err.message });
        } else {
            console.log(`✅ Fetched ${rows.length} sales from database`);
            res.json(rows);
        }
    });
});

// Record new sale
app.post('/api/sales', (req, res) => {
    console.log('💰 Recording new sale to database...');
    
    const { product_id, quantity, sale_date, customer_name } = req.body;
    
    // Validate input
    if (!product_id || !quantity || !sale_date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // First, get the product details
    db.get(`SELECT * FROM products WHERE id = ?`, [product_id], (err, product) => {
        if (err) {
            console.error('❌ Error fetching product:', err);
            return res.status(500).json({ error: err.message });
        }
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        if (product.stock < quantity) {
            return res.status(400).json({ 
                error: `Insufficient stock! Available: ${product.stock}` 
            });
        }
        
        // Calculate sale details
        const total = quantity * product.selling_price;
        const profit = quantity * (product.selling_price - product.purchase_price);
        const newStock = product.stock - quantity;
        const newTotalSold = product.total_sold + quantity;
        
        // Start transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // Insert sale record
            db.run(`
                INSERT INTO sales (product_id, product_name, quantity, sale_price, 
                                 purchase_price, total, profit, sale_date, customer_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                product_id, product.name, quantity, product.selling_price,
                product.purchase_price, total, profit, sale_date, 
                customer_name || 'Walk-in Customer'
            ], function(err) {
                if (err) {
                    console.error('❌ Error recording sale:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                const saleId = this.lastID;
                
                // Update product stock
                db.run(`
                    UPDATE products 
                    SET stock = ?, total_sold = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `, [newStock, newTotalSold, product_id], function(err) {
                    if (err) {
                        console.error('❌ Error updating product stock:', err);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }
                    
                    db.run('COMMIT');
                    console.log(`✅ Sale recorded with ID: ${saleId}`);
                    
                    // Return the sale details
                    db.get(`SELECT * FROM sales WHERE id = ?`, [saleId], (err, sale) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                        } else {
                            res.json(sale);
                        }
                    });
                });
            });
        });
    });
});

// ========== ANALYTICS ROUTES ==========

// Get business analytics
app.get('/api/analytics', (req, res) => {
    console.log('📊 Generating business analytics...');
    
    const queries = {
        totalProducts: `SELECT COUNT(*) as count FROM products`,
        totalSales: `SELECT COALESCE(SUM(total), 0) as total FROM sales`,
        totalProfit: `SELECT COALESCE(SUM(profit), 0) as total FROM sales`,
        lowStockItems: `SELECT COUNT(*) as count FROM products WHERE stock <= min_stock`,
        todaySales: `SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE sale_date = date('now')`,
        todayProfit: `SELECT COALESCE(SUM(profit), 0) as total FROM sales WHERE sale_date = date('now')`,
        weekSales: `SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE sale_date >= date('now', '-7 days')`,
        monthSales: `SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE sale_date >= date('now', '-30 days')`
    };
    
    const results = {};
    let completed = 0;
    const total = Object.keys(queries).length;
    
    Object.entries(queries).forEach(([key, query]) => {
        db.get(query, (err, row) => {
            if (err) {
                console.error(`❌ Error in analytics query ${key}:`, err);
                results[key] = 0;
            } else {
                results[key] = row.total !== undefined ? row.total : row.count;
            }
            
            completed++;
            if (completed === total) {
                console.log('✅ Analytics generated successfully');
                res.json(results);
            }
        });
    });
});

// ========== DATA MANAGEMENT ROUTES ==========

// Export all data
app.get('/api/export', (req, res) => {
    console.log('📥 Exporting database...');
    
    db.all(`SELECT * FROM products ORDER BY created_at`, (err, products) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        db.all(`SELECT * FROM sales ORDER BY created_at`, (err, sales) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            const exportData = {
                products,
                sales,
                exportDate: new Date().toISOString(),
                version: '2.0',
                database: 'SQLite'
            };
            
            console.log(`✅ Database exported: ${products.length} products, ${sales.length} sales`);
            res.json(exportData);
        });
    });
});

// Clear all data
app.delete('/api/clear-all', (req, res) => {
    console.log('🗑️ Clearing all database records...');
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(`DELETE FROM sales`, (err) => {
            if (err) {
                console.error('❌ Error clearing sales:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            
            db.run(`DELETE FROM products`, (err) => {
                if (err) {
                    console.error('❌ Error clearing products:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                // Reset auto-increment counters
                db.run(`DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales')`, (err) => {
                    if (err) {
                        console.error('❌ Error resetting sequences:', err);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }
                    
                    db.run('COMMIT');
                    console.log('✅ All database records cleared');
                    res.json({ message: 'All data cleared successfully' });
                });
            });
        });
    });
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

// Start server only after database is initialized
async function startServer() {
    try {
        console.log('🔄 Starting Stationery Business Manager...');
        
        // Connect and initialize database first
        await connectDatabase();
        
        // Start the Express server
        app.listen(PORT, () => {
            console.log(`🚀 Stationery Business Manager Server running on port ${PORT}`);
            console.log(`📱 Access the application at: http://localhost:${PORT}`);
            console.log(`🗄️ Database: SQLite (${dbPath})`);
            console.log(`📡 API endpoints available at: http://localhost:${PORT}/api/*`);
            console.log(`✅ Database initialization: ${dbInitialized ? 'Complete' : 'Failed'}`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the application
startServer();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    db.close(() => {
        process.exit(0);
    });
});