require('dotenv').config();
const { Pool } = require('pg');

console.log('🌱 Starting database seeding with sample data...');

// Create PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Sample products data
const sampleProducts = [
    { name: 'Ballpoint Pen (Blue)', purchase_price: 2.50, selling_price: 5.00, stock: 100, min_stock: 10 },
    { name: 'Ballpoint Pen (Black)', purchase_price: 2.50, selling_price: 5.00, stock: 80, min_stock: 10 },
    { name: 'Ballpoint Pen (Red)', purchase_price: 2.50, selling_price: 5.00, stock: 60, min_stock: 10 },
    { name: 'A4 Notebook (200 pages)', purchase_price: 15.00, selling_price: 25.00, stock: 50, min_stock: 5 },
    { name: 'A4 Notebook (100 pages)', purchase_price: 8.00, selling_price: 15.00, stock: 75, min_stock: 8 },
    { name: 'Pencil HB', purchase_price: 1.50, selling_price: 3.00, stock: 120, min_stock: 15 },
    { name: 'Eraser', purchase_price: 1.00, selling_price: 2.50, stock: 90, min_stock: 10 },
    { name: 'Ruler (30cm)', purchase_price: 3.00, selling_price: 6.00, stock: 40, min_stock: 5 },
    { name: 'Highlighter (Yellow)', purchase_price: 4.00, selling_price: 8.00, stock: 35, min_stock: 5 },
    { name: 'Highlighter (Pink)', purchase_price: 4.00, selling_price: 8.00, stock: 30, min_stock: 5 },
    { name: 'Stapler', purchase_price: 12.00, selling_price: 22.00, stock: 25, min_stock: 3 },
    { name: 'Stapler Pins (Box)', purchase_price: 2.00, selling_price: 4.50, stock: 60, min_stock: 8 },
    { name: 'A4 Paper (500 sheets)', purchase_price: 8.00, selling_price: 15.00, stock: 45, min_stock: 5 },
    { name: 'Correction Tape', purchase_price: 5.50, selling_price: 10.00, stock: 40, min_stock: 5 },
    { name: 'Permanent Marker (Black)', purchase_price: 6.00, selling_price: 12.00, stock: 25, min_stock: 3 },
    { name: 'Glue Stick', purchase_price: 3.50, selling_price: 7.00, stock: 55, min_stock: 8 },
    { name: 'Calculator', purchase_price: 25.00, selling_price: 45.00, stock: 15, min_stock: 2 },
    { name: 'File Folder', purchase_price: 2.00, selling_price: 4.00, stock: 70, min_stock: 10 },
    { name: 'Spiral Notebook', purchase_price: 6.00, selling_price: 12.00, stock: 40, min_stock: 5 },
    { name: 'Scissors', purchase_price: 8.00, selling_price: 15.00, stock: 20, min_stock: 3 }
];

// Sample sales data (for demonstration)
const sampleSales = [
    { product_id: 1, quantity: 5, sale_date: '2025-08-20', customer_name: 'John Doe' },
    { product_id: 2, quantity: 3, sale_date: '2025-08-20', customer_name: 'Jane Smith' },
    { product_id: 4, quantity: 2, sale_date: '2025-08-19', customer_name: 'Walk-in Customer' },
    { product_id: 6, quantity: 8, sale_date: '2025-08-19', customer_name: 'School Purchase' },
    { product_id: 1, quantity: 10, sale_date: '2025-08-18', customer_name: 'Office Supply' },
    { product_id: 13, quantity: 1, sale_date: '2025-08-18', customer_name: 'Maria Garcia' },
    { product_id: 7, quantity: 4, sale_date: '2025-08-17', customer_name: 'Walk-in Customer' },
    { product_id: 9, quantity: 2, sale_date: '2025-08-17', customer_name: 'Student Purchase' }
];

async function seedDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🔗 Connected to database');
        
        // Check if data already exists
        const existingProducts = await client.query('SELECT COUNT(*) FROM products');
        const productCount = parseInt(existingProducts.rows[0].count);
        
        if (productCount > 0) {
            console.log(`⚠️ Database already contains ${productCount} products. Skipping seeding.`);
            console.log('💡 To re-seed, first clear the database using: npm run reset-db');
            return;
        }
        
        await client.query('BEGIN');
        
        // Insert sample products
        console.log('📦 Inserting sample products...');
        let insertedProducts = [];
        
        for (const product of sampleProducts) {
            const result = await client.query(`
                INSERT INTO products (name, purchase_price, selling_price, stock, min_stock)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, name
            `, [product.name, product.purchase_price, product.selling_price, product.stock, product.min_stock]);
            
            insertedProducts.push(result.rows[0]);
        }
        
        console.log(`✅ Inserted ${insertedProducts.length} sample products`);
        
        // Insert sample sales
        console.log('💰 Inserting sample sales...');
        let insertedSales = 0;
        
        for (const sale of sampleSales) {
            // Get product details for the sale
            const productResult = await client.query('SELECT * FROM products WHERE id = $1', [sale.product_id]);
            
            if (productResult.rows.length > 0) {
                const product = productResult.rows[0];
                
                // Calculate sale details
                const total = sale.quantity * product.selling_price;
                const profit = sale.quantity * (product.selling_price - product.purchase_price);
                
                // Insert sale
                await client.query(`
                    INSERT INTO sales (product_id, product_name, quantity, sale_price, purchase_price, total, profit, sale_date, customer_name)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    sale.product_id, 
                    product.name, 
                    sale.quantity, 
                    product.selling_price, 
                    product.purchase_price, 
                    total, 
                    profit, 
                    sale.sale_date, 
                    sale.customer_name
                ]);
                
                // Update product stock and total_sold
                const newStock = product.stock - sale.quantity;
                const newTotalSold = product.total_sold + sale.quantity;
                
                await client.query(`
                    UPDATE products 
                    SET stock = $1, total_sold = $2, updated_at = NOW()
                    WHERE id = $3
                `, [newStock, newTotalSold, sale.product_id]);
                
                insertedSales++;
            }
        }
        
        await client.query('COMMIT');
        
        console.log(`✅ Inserted ${insertedSales} sample sales`);
        console.log('✅ Updated product stock levels');
        
        // Display summary
        const finalProductCount = await client.query('SELECT COUNT(*) FROM products');
        const finalSaleCount = await client.query('SELECT COUNT(*) FROM sales');
        const totalValue = await client.query('SELECT SUM(stock * selling_price) as total_inventory_value FROM products');
        
        console.log('\n📊 SEEDING SUMMARY:');
        console.log(`📦 Products: ${finalProductCount.rows[0].count}`);
        console.log(`💰 Sales: ${finalSaleCount.rows[0].count}`);
        console.log(`💵 Total Inventory Value: ${parseFloat(totalValue.rows[0].total_inventory_value).toFixed(2)}`);
        console.log('\n🚀 Database seeding completed successfully!');
        console.log('🌐 Your stationery business is ready to go!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run seeding
seedDatabase();