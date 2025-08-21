const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database setup
const dbPath = path.join(__dirname, 'stationery_business.db');

console.log('🗄️ Initializing Stationery Business Database...');
console.log('📍 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    console.log('🔧 Creating database tables...');
    
    db.serialize(() => {
        // Enable foreign keys
        db.run("PRAGMA foreign_keys = ON", (err) => {
            if (err) {
                console.error('❌ Error enabling foreign keys:', err);
            } else {
                console.log('✅ Foreign keys enabled');
            }
        });

        // Create products table
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
                process.exit(1);
            } else {
                console.log('✅ Products table created successfully');
            }
        });

        // Create sales table
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
                process.exit(1);
            } else {
                console.log('✅ Sales table created successfully');
            }
        });

        // Create indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)`, (err) => {
            if (err) {
                console.error('❌ Error creating products index:', err);
            } else {
                console.log('✅ Products index created');
            }
        });
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)`, (err) => {
            if (err) {
                console.error('❌ Error creating sales date index:', err);
            } else {
                console.log('✅ Sales date index created');
            }
        });
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id)`, (err) => {
            if (err) {
                console.error('❌ Error creating sales product index:', err);
            } else {
                console.log('✅ Sales product index created');
            }
        });

        // Verify and show table structure
        setTimeout(() => {
            db.all(`SELECT name FROM sqlite_master WHERE type='table'`, (err, tables) => {
                if (err) {
                    console.error('❌ Error verifying tables:', err);
                    process.exit(1);
                } else {
                    console.log('\n📊 Database Tables Created:');
                    tables.forEach(table => {
                        console.log(`  ✅ ${table.name}`);
                    });
                    
                    // Show table schemas
                    console.log('\n🔍 Table Schemas:');
                    
                    db.all(`PRAGMA table_info(products)`, (err, columns) => {
                        if (err) {
                            console.error('❌ Error getting products schema:', err);
                        } else {
                            console.log('\n📦 Products Table:');
                            columns.forEach(col => {
                                console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
                            });
                        }
                        
                        db.all(`PRAGMA table_info(sales)`, (err, columns) => {
                            if (err) {
                                console.error('❌ Error getting sales schema:', err);
                            } else {
                                console.log('\n💰 Sales Table:');
                                columns.forEach(col => {
                                    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
                                });
                            }
                            
                            console.log('\n🎉 Database initialization completed successfully!');
                            console.log('💡 You can now run: npm start');
                            
                            // Close database connection
                            db.close((err) => {
                                if (err) {
                                    console.error('❌ Error closing database:', err);
                                } else {
                                    console.log('✅ Database connection closed');
                                }
                                process.exit(0);
                            });
                        });
                    });
                }
            });
        }, 1000); // Wait for all operations to complete
    });
}