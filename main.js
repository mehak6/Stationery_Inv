const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

// Function to check if server is running
function checkServer(port, callback) {
    const options = {
        hostname: 'localhost',
        port: port,
        path: '/api/status',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        callback(true);
    });

    req.on('error', () => {
        callback(false);
    });

    req.end();
}

// Function to start the Express server
function startServer() {
    return new Promise((resolve, reject) => {
        console.log('Starting Express server...');

        // Start server.js as a child process
        serverProcess = spawn('node', ['server.js'], {
            stdio: 'inherit',
            cwd: __dirname
        });

        serverProcess.on('error', (error) => {
            console.error('Failed to start server:', error);
            reject(error);
        });

        // Wait for server to be ready
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max

        const checkInterval = setInterval(() => {
            attempts++;

            checkServer(3000, (isRunning) => {
                if (isRunning) {
                    console.log('Server is running on port 3000');
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('Server failed to start within 30 seconds'));
                }
            });
        }, 1000);
    });
}

// Function to create the main Electron window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        icon: path.join(__dirname, 'public', 'favicon.ico'), // Add icon if available
        title: 'Stationery Business Manager'
    });

    // Remove menu bar for cleaner look
    Menu.setApplicationMenu(null);

    // Load the web app
    mainWindow.loadURL('http://localhost:3000');

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App event handlers
app.whenReady().then(async () => {
    try {
        console.log('Starting Stationery Business Manager...');

        // Start the Express server first
        await startServer();

        // Create the Electron window
        createWindow();

        console.log('Stationery Business Manager is ready!');
    } catch (error) {
        console.error('Failed to start application:', error);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle app quit
app.on('before-quit', () => {
    console.log('Shutting down...');

    // Kill the server process
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    app.quit();
});