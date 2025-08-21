# 📊 Stationery Business Manager with SQLite Database

A complete business management system for stationery stores with SQLite database integration, featuring inventory management, sales tracking, and comprehensive analytics.

## 🗄️ Database Features

- **SQLite Database**: Server-side persistent storage
- **Real-time Data**: Automatic synchronization between frontend and database
- **Data Integrity**: Transaction-based operations for consistency
- **Backup & Export**: Complete database export functionality
- **Analytics**: Advanced business intelligence from database queries

## 🚀 Quick Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. **Extract/Clone the project files**
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Access the application**:
   - Open your browser and go to `http://localhost:3000`
   - The SQLite database will be automatically created on first run

## 📁 Project Structure

```
stationery-business-manager/
├── server.js              # Express server with SQLite integration
├── package.json           # Dependencies and scripts
├── public/
│   └── index.html         # Frontend application
├── stationery_business.db # SQLite database file (auto-created)
└── README.md             # This guide
```

## 🗄️ Database Schema

### Products Table
```sql
CREATE TABLE products (
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
);
```

### Sales Table
```sql
CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    sale_price REAL NOT NULL,
    purchase_price REAL NOT NULL,
    total REAL NOT NULL,
    profit REAL NOT NULL,
    sale_date DATE NOT NULL,
    customer_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id)
);
```

## 🔌 API Endpoints

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Add new product
- `PUT /api/products/:id/stock` - Update product stock
- `DELETE /api/products/:id` - Delete product

### Sales
- `GET /api/sales` - Get all sales
- `POST /api/sales` - Record new sale

### Analytics
- `GET /api/analytics` - Get business analytics
- `GET /api/status` - Get database status

### Data Management
- `GET /api/export` - Export all data
- `DELETE /api/clear-all` - Clear all data

## 📊 Features

### 📦 Inventory Management
- Add/edit/delete products
- Real-time stock tracking
- Low stock alerts
- Purchase and selling price management

### 💰 Sales Tracking
- Record sales transactions
- Customer information
- Automatic stock deduction
- Profit calculation

### 📈 Business Analytics
- Daily, weekly, monthly sales reports
- Profit margins and trends
- Best-selling products analysis
- Low stock monitoring

### 🎯 Dashboard
- Real-time business metrics
- Database connection status
- Quick action buttons
- Performance summaries

## 🔧 Available Scripts

```bash
# Start the production server
npm start

# Start development server with auto-reload
npm run dev

# Install all dependencies
npm run install-deps

# Complete setup (install + instructions)
npm run setup

# Reset database (deletes database file)
npm run reset-db

# Backup database file
npm run backup-db
```

## 💾 Database Operations

### Backup Your Data
1. **Automatic Export**: Use the "Export Data" button in the application
2. **Manual Backup**: Run `npm run backup-db` to backup the database file
3. **File Copy**: Copy `stationery_business.db` to a safe location

### Restore Data
1. Replace the `stationery_business.db` file with your backup
2. Restart the server
3. The application will automatically connect to the restored database

### Reset Database
```bash
npm run reset-db
npm start
```

## 🌐 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## 📱 Mobile Responsive

The application is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## ⌨️ Keyboard Shortcuts

- `Ctrl + 1-4`: Switch between tabs
- `Ctrl + R`: Refresh connection
- `Ctrl + E`: Export data

## 🔒 Security Features

- Input validation and sanitization
- SQL injection prevention
- Transaction-based operations
- Error handling and logging

## 🔧 Troubleshooting

### Database Connection Issues
1. Check if the server is running on port 3000
2. Verify Node.js and npm are properly installed
3. Check console logs for specific error messages
4. Try refreshing the page or restarting the server

### Port Already in Use
```bash
# Kill process on port 3000 (if needed)
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Database File Issues
1. Check if you have write permissions in the project directory
2. The database file will be created automatically on first run
3. If corrupted, delete the database file and restart the server

## 🚀 Production Deployment

### Environment Variables
```bash
PORT=3000                    # Server port
NODE_ENV=production         # Environment mode
```

### PM2 Process Manager (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start application with PM2
pm2 start server.js --name "stationery-manager"

# Save PM2 configuration
pm2 save
pm2 startup
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

## 📄 License

MIT License - Feel free to use this project for your business needs.

## 🆘 Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify all dependencies are installed correctly
3. Ensure you have proper file permissions
4. Try resetting the database if data appears corrupted

## 🔄 Updates & Migrations

### Version 2.0.0 (Current)
- SQLite database integration
- Server-side data persistence
- RESTful API architecture
- Enhanced security and validation
- Real-time connection monitoring

### Migrating from LocalStorage Version
1. Export your data from the old version (if available)
2. Set up the new SQLite version
3. Manually re-enter your products and sales data
4. The new system will provide better reliability and features

---

**Happy Business Managing! 📈💼**