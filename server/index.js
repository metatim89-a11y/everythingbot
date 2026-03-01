// Version: 1.44
/**
 * MCP Server for everythingbot
 * "Belly" Verbose Mode with Mandatory Signatures.
 */

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const os = require('os');
const { spawn } = require('child_process');
const { body, param, validationResult } = require('express-validator');

// --- SSE Client Store ---
let sseClients = [];

let serviceStatus = {
    mcp: 'READY',
    nlp: 'STARTING',
    web: 'READY'
};

const broadcastEvent = (type, data) => {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => client.res.write(payload));
};

const broadcastStatus = () => {
    broadcastEvent('service_status', serviceStatus);
};

// --- Real-time Metrics Store ---
let systemMetrics = {
    uptime: Date.now(),
    totalRequests: 0,
    errorCount: 0,
    activeConnections: 0,
    latencies: [], // Last 100 request times
    lastBottleNeck: null
};

// --- AI Configuration (Real-time) ---
let aiConfig = {
    max_new_tokens: 128,
    temperature: 0.7
};

// --- SECURITY: AI Only Secret Token ---
const AI_ONLY_TOKEN = "e89b3f94-7a1a-4f5c-8d2b-6c4e1f7a8b9c"; // System-internal secret

/**
 * INTERNAL SECURITY MIDDLEWARE
 */
const checkInternalAuth = (req, res, next) => {
    const token = req.headers['x-ai-only-token'];
    const isLocal = req.connection.remoteAddress === '127.0.0.1' || req.connection.remoteAddress === '::1';
    
    if (token === AI_ONLY_TOKEN && isLocal) {
        next();
    } else {
        console.warn(`SECURITY_ALERT: Unauthorized attempt to access internal AI endpoint from ${req.connection.remoteAddress}`);
        res.status(403).json({ success: false, error: "Access Denied: Internal AI Pillar Only." });
    }
};



// --- Mandatory Signature Logic ---
const getSignature = () => {
    const now = new Date();
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear().toString().slice(-2);
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    return `{{geminiCLI/gemini3 ${month}/${day}/${year}/${hours}:${minutes}${ampm}}}`;
};

// Wrap console to ensure every line is signed
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => originalLog.apply(console, [...args, getSignature()]);
console.warn = (...args) => originalWarn.apply(console, [...args, getSignature()]);
console.error = (...args) => originalError.apply(console, [...args, getSignature()]);

console.log('STARTUP: MCP Server "Belly" initialization sequence starting...');

const app = express();
const PORT = 3000;
const NLP_SERVICE_URL = "http://localhost:8000/chat";
const NLP_TIMEOUT = 300000; // 5 minute timeout for slow CPU generation

const PROJECT_ROOT_DIR = path.join(__dirname, '..');
const DB_PATH_TRAINING = path.join(PROJECT_ROOT_DIR, 'data', 'training.db');
const DB_PATH_AI_ONLY = path.join(PROJECT_ROOT_DIR, 'data', 'ai_only.db');
const DB_PATH_SCRAPER = path.join(PROJECT_ROOT_DIR, 'data', 'scraper_results.db');
const UPLOADS_DIR = path.join(PROJECT_ROOT_DIR, 'data', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// --- Persistent DB Connections ---
const dbTraining = new sqlite3.Database(DB_PATH_TRAINING);
const dbAiOnly = new sqlite3.Database(DB_PATH_AI_ONLY);
const dbScraper = new sqlite3.Database(DB_PATH_SCRAPER);

/**
 * Initialize Tables.
 */
dbTraining.serialize(() => {
    // Create chat_sessions table
    dbTraining.run(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            archived INTEGER DEFAULT 0
        )
    `, (err) => {
        if (err) console.error(`BELLY_DB_ERROR: Could not create chat_sessions: ${err.message}`);
        else {
            dbTraining.run("ALTER TABLE chat_sessions ADD COLUMN archived INTEGER DEFAULT 0", (err2) => {
                if (err2 && !err2.message.includes("duplicate column name")) console.warn(`BELLY_DB_WARN: ${err2.message}`);
            });
        }
    });

    // Create bot_log table
    dbTraining.run(`
        CREATE TABLE IF NOT EXISTS bot_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            user_input TEXT,
            bot_response TEXT,
            rating INTEGER DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error(`BELLY_DB_ERROR: Could not create bot_log: ${err.message}`);
        else {
            dbTraining.run("ALTER TABLE bot_log ADD COLUMN session_id INTEGER", (err2) => {
                if (err2 && !err2.message.includes("duplicate column name")) console.warn(`BELLY_DB_WARN: ${err2.message}`);
            });
            dbTraining.run("ALTER TABLE bot_log ADD COLUMN rating INTEGER DEFAULT 0", (err3) => {
                if (err3 && !err3.message.includes("duplicate column name")) console.warn(`BELLY_DB_WARN: ${err3.message}`);
            });
        }
    });

    // Create uploaded_files table
    dbTraining.run(`
        CREATE TABLE IF NOT EXISTS uploaded_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            filename TEXT,
            original_name TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error(`BELLY_DB_ERROR: Could not create uploaded_files: ${err.message}`);
        else console.log(`BELLY_DB: Initialized uploaded_files table.`);
    });

    // Create keyword_profiles table
    dbTraining.run(`
        CREATE TABLE IF NOT EXISTS keyword_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            keywords TEXT,
            target_url TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error(`BELLY_DB_ERROR: Could not create keyword_profiles: ${err.message}`);
        else {
            console.log(`BELLY_DB: Initialized keyword_profiles table.`);
            dbTraining.run("ALTER TABLE keyword_profiles ADD COLUMN target_url TEXT", (err2) => {
                if (err2 && !err2.message.includes("duplicate column name")) console.warn(`BELLY_DB_WARN: ${err2.message}`);
            });
        }
    });

    // Create scraped_leads table
    dbTraining.run(`
        CREATE TABLE IF NOT EXISTS scraped_leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_name TEXT,
            platform TEXT,
            content TEXT,
            url TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error(`BELLY_DB_ERROR: Could not create scraped_leads: ${err.message}`);
        else console.log(`BELLY_DB: Initialized scraped_leads table.`);
    });
});

dbAiOnly.serialize(() => {
    dbAiOnly.run(`
        CREATE TABLE IF NOT EXISTS techstack_knowledge (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT UNIQUE,
            concept_description TEXT,
            code_example TEXT,
            author TEXT DEFAULT 'Gemini Pro',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error(`BELLY_DB_ERROR: Could not create techstack_knowledge: ${err.message}`);
        else console.log(`BELLY_DB: Initialized techstack_knowledge table in ai_only.db.`);
    });
});

/**
 * Multer Config for File Uploads
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

/**
 * Log an event (Obsolete: ai_only.db was removed). 
 * This function is kept as a stub for backwards compatibility.
 */
function logEvent(source, level, message, details = {}) {
    console.log(`[STUB_LOG_EVENT] ${source} - ${level}: ${message}`);
}

app.use(bodyParser.json());
app.use(cors());

// Verbose Request Belly-Trace + Metrics Collection
app.use((req, res, next) => {
    const start = Date.now();
    systemMetrics.totalRequests++;
    systemMetrics.activeConnections++;
    
    console.log(`BELLY_TRACE: Incoming ${req.method} ${req.url}`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        systemMetrics.activeConnections--;
        
        // Track latency
        systemMetrics.latencies.push(duration);
        if (systemMetrics.latencies.length > 100) systemMetrics.latencies.shift();
        
        // Error tracking
        if (res.statusCode >= 400) {
            systemMetrics.errorCount++;
            serviceStatus.mcp = 'ERROR';
            broadcastStatus();
        }
        
        // Bottleneck identification
        if (duration > 5000) {
            systemMetrics.lastBottleNeck = {
                route: req.url,
                duration: duration,
                timestamp: new Date().toISOString()
            };
        }
        
        console.log(`BELLY_TRACE: Finished ${req.method} ${req.url} [${res.statusCode}] in ${duration}ms`);
        
        // Push metrics "as needed" (only when something actually changed)
        broadcastEvent('metrics', {
            app: {
                totalRequests: systemMetrics.totalRequests,
                activeConnections: systemMetrics.activeConnections,
                errorCount: systemMetrics.errorCount,
                avgLatencyMs: systemMetrics.latencies.length > 0 
                    ? (systemMetrics.latencies.reduce((a, b) => a + b, 0) / systemMetrics.latencies.length).toFixed(2)
                    : 0,
                lastBottleNeck: systemMetrics.lastBottleNeck
            }
        });
    });
    next();
});

// --- SSE Endpoint ---
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    sseClients.push(newClient);

    console.log(`SSE_HUB: Client ${clientId} connected. Total: ${sseClients.length}`);

    // Initial push
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

    req.on('close', () => {
        sseClients = sseClients.filter(c => c.id !== clientId);
        console.log(`SSE_HUB: Client ${clientId} disconnected. Total: ${sseClients.length}`);
    });
});

// --- Routes ---

app.get('/health', (req, res) => {
    console.log('BELLY_CHECK: Health probe received.');
    res.json({ 
        status: 'UP', 
        signature: getSignature(),
        metrics: {
            totalRequests: systemMetrics.totalRequests,
            activeConnections: systemMetrics.activeConnections,
            errorCount: systemMetrics.errorCount
        }
    });
});

app.get('/api/system/metrics', (req, res) => {
    const avgLatency = systemMetrics.latencies.length > 0 
        ? (systemMetrics.latencies.reduce((a, b) => a + b, 0) / systemMetrics.latencies.length).toFixed(2)
        : 0;

    res.json({
        success: true,
        os: {
            platform: os.platform(),
            uptime: os.uptime(),
            loadavg: os.loadavg(),
            freeMem: os.freemem(),
            totalMem: os.totalmem(),
            cpuUsage: (1 - (os.freemem() / os.totalmem())) * 100
        },
        app: {
            uptime: Math.floor((Date.now() - systemMetrics.uptime) / 1000),
            totalRequests: systemMetrics.totalRequests,
            activeConnections: systemMetrics.activeConnections,
            errorCount: systemMetrics.errorCount,
            avgLatencyMs: avgLatency,
            lastBottleNeck: systemMetrics.lastBottleNeck
        }
    });
});

app.post('/api/system/relaunch', checkInternalAuth, (req, res) => {
    console.warn("SYSTEM_ALERT: Global Relaunch triggered via command center.");
    res.json({ success: true, message: "Relaunch sequence initiated." });
    spawn('bash', ['-c', 'source /home/tim/projects/everythingbot/.hidden/aliases.sh && LA'], { detached: true, stdio: 'ignore' }).unref();
});

app.post('/api/system/relaunch/mcp', checkInternalAuth, (req, res) => {
    console.warn("SYSTEM_ALERT: MCP Relaunch triggered.");
    res.json({ success: true, message: "MCP Server restarting..." });
    spawn('bash', ['-c', 'bash /home/tim/projects/everythingbot/server/launch_mcp_server.sh'], { detached: true, stdio: 'ignore' }).unref();
});

app.post('/api/system/relaunch/nlp', checkInternalAuth, (req, res) => {
    console.warn("SYSTEM_ALERT: NLP Relaunch triggered.");
    res.json({ success: true, message: "NLP Service restarting..." });
    spawn('bash', ['-c', 'bash /home/tim/projects/everythingbot/server/launch_nlp_service.sh'], { detached: true, stdio: 'ignore' }).unref();
});

app.post('/api/system/relaunch/web', checkInternalAuth, (req, res) => {
    console.warn("SYSTEM_ALERT: Web UI Relaunch triggered.");
    res.json({ success: true, message: "Web UI restarting..." });
    spawn('bash', ['-c', 'bash /home/tim/projects/everythingbot/server/launch_web_ui.sh'], { detached: true, stdio: 'ignore' }).unref();
});

// --- Independent Service Stop Endpoints ---

app.post('/api/system/stop/mcp', checkInternalAuth, (req, res) => {
    console.warn("SYSTEM_ALERT: MCP Stop requested. Process will terminate.");
    res.json({ success: true, message: "MCP Server shutting down..." });
    setTimeout(() => {
        spawn('bash', ['-c', 'pkill -9 -f "node index.js" && lsof -t -i:3000 | xargs -r kill -9'], { detached: true, stdio: 'ignore' }).unref();
    }, 500);
});

app.post('/api/system/stop/nlp', checkInternalAuth, (req, res) => {
    console.warn("SYSTEM_ALERT: NLP Stop requested.");
    spawn('bash', ['-c', 'pkill -9 -f "app.nlp_service:app" && lsof -t -i:8000 | xargs -r kill -9'], { detached: true, stdio: 'ignore' }).unref();
    res.json({ success: true, message: "NLP Service stopped." });
});

app.post('/api/system/stop/web', checkInternalAuth, (req, res) => {
    console.warn("SYSTEM_ALERT: Web UI Stop requested.");
    spawn('bash', ['-c', 'pkill -9 -f "react-scripts start" && lsof -t -i:3001 | xargs -r kill -9'], { detached: true, stdio: 'ignore' }).unref();
    res.json({ success: true, message: "Web UI stopped." });
});

app.get('/config', (req, res) => {
    res.json(aiConfig);
});

app.post('/config', (req, res) => {
    const { max_new_tokens, temperature } = req.body;
    if (max_new_tokens) aiConfig.max_new_tokens = parseInt(max_new_tokens);
    if (temperature !== undefined) aiConfig.temperature = parseFloat(temperature);
    console.log(`BELLY_CONFIG: AI settings updated: ${JSON.stringify(aiConfig)}`);
    res.json({ success: true, config: aiConfig });
});

app.get('/sessions', (req, res) => {
    console.log('BELLY_DB: Fetching all sessions.');
    dbTraining.all("SELECT * FROM chat_sessions WHERE archived = 0 ORDER BY id DESC", (err, rows) => {
        if (err) {
            console.error(`BELLY_DB_ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ sessions: rows });
    });
});

app.get('/history/:sid', (req, res) => {
    const { sid } = req.params;
    console.log(`BELLY_DB: Fetching history for SID ${sid}`);
    dbTraining.all("SELECT * FROM bot_log WHERE session_id = ? ORDER BY id ASC", [sid], (err, rows) => {
        if (err) {
            console.error(`BELLY_DB_ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ history: rows });
    });
});

app.post('/chat', async (req, res) => {
    const { message, session_id } = req.body;
    console.log(`BELLY_CHAT: Processing request for SID ${session_id || 'NEW'}`);

    try {
        let sid = session_id;
        if (!sid) {
            sid = await new Promise((resolve, reject) => {
                dbTraining.run("INSERT INTO chat_sessions (name) VALUES (?)", [`Session ${new Date().toLocaleString()}`], function (err) {
                    if (err) reject(err); else resolve(this.lastID);
                });
            });
            console.log(`BELLY_DB: Created new session ID: ${sid}`);
        }

        console.log(`BELLY_NLP: Forwarding to NLP Core (Timeout: ${NLP_TIMEOUT}ms)...`);
        const nlpResponse = await axios.post(NLP_SERVICE_URL, { message, session_id: sid }, { timeout: NLP_TIMEOUT });

        const botResponseText = nlpResponse.data.response;
        console.log(`BELLY_NLP: Response received from core.`);
        serviceStatus.nlp = 'READY';
        broadcastStatus();

        dbTraining.run("INSERT INTO bot_log (session_id, user_input, bot_response) VALUES (?, ?, ?)",
            [sid, message, JSON.stringify(botResponseText)],
            function (err) {
                if (err) {
                    console.error(`BELLY_DB_ERROR: ${err.message}`);
                    return res.status(500).json({ success: false });
                }
                const msgId = this.lastID;
                dbTraining.get("SELECT timestamp FROM bot_log WHERE id = ?", [msgId], (err, row) => {
                    res.json({
                        success: true,
                        response: botResponseText,
                        session_id: sid,
                        message_id: msgId,
                        timestamp: row ? row.timestamp : new Date().toISOString()
                    });
                });
            }
        );
    } catch (error) {
        console.error(`BELLY_FATAL: ${error.message}`);
        serviceStatus.nlp = 'ERROR';
        broadcastStatus();
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/agent/chat', async (req, res) => {
    const { message, context, actionResponse } = req.body;

    // 1. Intercept DB Actions that have been explicitly approved by the human-in-the-loop
    if (actionResponse && actionResponse.approved && actionResponse.step === 'DB_INSERT') {
        const sql = actionResponse.payload;
        console.log(`[AGENT_ORCHESTRATOR] Administrator approved SQL execution: ${sql}`);

        try {
            dbTraining.exec(sql, function (err) {
                if (err) {
                    console.error(`[DB_INSERT_ERROR] ${err.message}`);
                    return res.json({ response: `I tried to run the query, but an SQL error occurred: ${err.message}`, pending_action: null });
                }
                return res.json({ response: `Excellent! The database tables have successfully processed the update via Node. I am ready for the next task.`, pending_action: null });
            });
            return;
        } catch (err) {
            return res.json({ response: `Critical backend error handling SQL proxy: ${err.message}`, pending_action: null });
        }
    }

    // 2. Otherwise, forward request upstream to the Python NLP Core
    try {
        console.log(`[AGENT_ORCHESTRATOR] Tunnelling context to NLP pipeline...`);
        const nlpResponse = await axios.post(`${NLP_SERVICE_URL}/agent`, {
            message,
            context,
            actionResponse
        }, { timeout: NLP_TIMEOUT * 2 }); // Give the local model more time since context is heavy

        // nlpResponse.data includes { response: string, pending_action: object | null }
        res.json(nlpResponse.data);
    } catch (err) {
        console.error(`[AGENT_ORCHESTRATOR] AI Core Connection Failed: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
});


// --- File Management Routes ---

app.post('/upload', upload.single('file'), (req, res) => {
    const { session_id } = req.body;
    const { filename, originalname } = req.file;
    console.log(`BELLY_FILE: Uploaded ${originalname} for session ${session_id}`);

    dbTraining.run(
        "INSERT INTO uploaded_files (session_id, filename, original_name) VALUES (?, ?, ?)",
        [session_id, filename, originalname],
        function (err) {
            if (err) {
                console.error(`BELLY_DB_ERROR: ${err.message}`);
                return res.status(500).json({ success: false });
            }
            res.json({ success: true, filename: filename });
        }
    );
});

app.get('/files/:sid', (req, res) => {
    const { sid } = req.params;
    console.log(`BELLY_DB: Fetching files for SID ${sid}`);
    dbTraining.all("SELECT * FROM uploaded_files WHERE session_id = ? ORDER BY id DESC", [sid], (err, rows) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, files: rows });
    });
});

app.get('/file/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, filename);
    console.log(`BELLY_FILE: Serving file ${filename}`);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ success: false, error: "File not found" });
    }
});

app.delete('/file/:filename', (req, res) => {
    const { filename } = req.params;
    console.log(`BELLY_FILE: Deleting file ${filename}`);
    dbTraining.run("DELETE FROM uploaded_files WHERE filename = ?", [filename], (err) => {
        if (err) return res.status(500).json({ success: false });
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ success: true });
    });
});

// --- Scraper & Worker Routes ---

app.post('/api/scrape', (req, res) => {
    const { profile_name } = req.body;
    if (!profile_name) {
        console.error(`BELLY_WORKER_ERROR: Missing profile_name in scrape request.`);
        return res.status(400).json({ success: false, error: "profile_name is required" });
    }

    console.log(`BELLY_WORKER: Triggering native scraper for profile '${profile_name}'`);

    // Fetch keywords and URL for the profile
    dbTraining.get("SELECT keywords, target_url FROM keyword_profiles WHERE name = ?", [profile_name], (err, row) => {
        if (err || !row) {
            console.error(`BELLY_WORKER_ERROR: Could not find profile keywords: ${err ? err.message : 'Not found'}`);
            return res.status(404).json({ success: false, error: "Profile not found or DB error" });
        }

        let keywordStr = "";
        try {
            const keywordsObj = JSON.parse(row.keywords);
            if (Array.isArray(keywordsObj)) {
                keywordStr = keywordsObj.join(",");
            }
        } catch (e) {
            console.error("BELLY_WORKER_ERROR: Failed to parse keywords:", e);
        }

        // Spawn the scraper process via the virtual environment
        const scraperScript = path.join(PROJECT_ROOT_DIR, 'worker', 'scraper', 'scraper_main.py');
        const pythonExecutable = path.join(PROJECT_ROOT_DIR, '.venv', 'bin', 'python');

        const args = [scraperScript, "--profile_name", profile_name, "--headed"];
        if (keywordStr) {
            args.push("--keywords");
            args.push(keywordStr);
        }
        if (row.target_url) {
            args.push("--target_url");
            args.push(row.target_url);
        }

        console.log(`BELLY_WORKER: Executing ${pythonExecutable} ${args.join(' ')}`);
        const pythonProcess = spawn(pythonExecutable, args);

        // Don't wait for completion to respond, it runs in background
        res.json({ success: true, message: `Scraper worker started in background for ${profile_name}.` });

        pythonProcess.stdout.on('data', (data) => {
            console.log(`[SCRAPER_STDOUT] ${data.toString().trim()}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[SCRAPER_STDERR] ${data.toString().trim()}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`BELLY_WORKER: Scraper for '${profile_name}' exited with code ${code}`);
        });
    });
});

app.get('/api/profiles', (req, res) => {
    console.log(`BELLY_DB: Fetching keyword profiles.`);
    dbTraining.all("SELECT * FROM keyword_profiles ORDER BY id DESC", (err, rows) => {
        if (err) {
            console.error(`BELLY_DB_ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, profiles: rows });
    });
});

app.post('/api/profiles', (req, res) => {
    const { name, keywords, target_url } = req.body;
    console.log(`BELLY_DB: Creating new profile '${name}' with target '${target_url}'`);
    dbTraining.run("INSERT INTO keyword_profiles (name, keywords, target_url) VALUES (?, ?, ?)", [name, keywords, target_url], function (err) {
        if (err) {
            console.error(`BELLY_DB_ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/profiles/:id', (req, res) => {
    const { id } = req.params;
    console.log(`BELLY_DB: Deleting profile ID ${id}`);
    dbTraining.run("DELETE FROM keyword_profiles WHERE id = ?", [id], (err) => {
        if (err) {
            console.error(`BELLY_DB_ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true });
    });
});

app.get('/api/leads', (req, res) => {
    console.log(`BELLY_DB: Fetching scraped leads.`);
    dbScraper.all("SELECT * FROM scraper_results ORDER BY found_at DESC LIMIT 200", (err, rows) => {
        if (err) {
            // Ignore error if table doesn't exist yet
            if (err.message.includes("no such table")) {
                return res.json({ success: true, leads: [] });
            }
            console.error(`BELLY_DB_ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, leads: rows });
    });
});

// --- Database Explorer Routes ---

app.get('/db/tables/:dbName', (req, res) => {
    let db = dbTraining;
    if (req.params.dbName === 'ai_only') db = dbAiOnly;
    if (req.params.dbName === 'scraper_results') db = dbScraper;

    console.log(`BELLY_DB: Fetching tables for ${req.params.dbName}`);
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, tables: rows.map(r => r.name) });
    });
});

app.get('/db/data/:dbName/:tableName', (req, res) => {
    const { tableName } = req.params;
    let db = dbTraining;
    if (req.params.dbName === 'ai_only') db = dbAiOnly;
    if (req.params.dbName === 'scraper_results') db = dbScraper;

    console.log(`BELLY_DB: Fetching data from ${req.params.dbName} [${tableName}]`);
    db.all(`SELECT * FROM ${tableName} LIMIT 100`, (err, rows) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, rows: rows });
    });
});

// --- History & Session Cleanup ---

app.delete('/history/delete/:id', (req, res) => {
    const { id } = req.params;
    console.log(`BELLY_DB: Deleting record ID ${id}`);
    dbTraining.run("DELETE FROM bot_log WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.delete('/sessions/:sid', (req, res) => {
    const { sid } = req.params;
    console.log(`BELLY_DB: Deleting session SID ${sid}`);
    dbTraining.run("DELETE FROM chat_sessions WHERE id = ?", [sid], (err) => {
        if (err) return res.status(500).json({ success: false });
        dbTraining.run("DELETE FROM bot_log WHERE session_id = ?", [sid], () => {
            dbTraining.run("DELETE FROM uploaded_files WHERE session_id = ?", [sid], () => {
                res.json({ success: true });
            });
        });
    });
});

app.put('/sessions/:sid', (req, res) => {
    const { sid } = req.params;
    const { name } = req.body;
    console.log(`BELLY_DB: Renaming session SID ${sid} to "${name}"`);
    dbTraining.run("UPDATE chat_sessions SET name = ? WHERE id = ?", [name, sid], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.put('/sessions/archive/:sid', (req, res) => {
    const { sid } = req.params;
    console.log(`BELLY_DB: Archiving session SID ${sid}`);
    dbTraining.run("UPDATE chat_sessions SET archived = 1 WHERE id = ?", [sid], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// Default Session Init
dbTraining.run("INSERT OR IGNORE INTO chat_sessions (id, name) VALUES (1, 'Default Session')", (err) => {
    if (err) originalError("BELLY_DB_INIT_ERR:", err);
});

// --- AI Only DB (Bot Techstack Training) ---
app.post('/ai-only/teach', checkInternalAuth, (req, res) => {
    const { topic, concept_description, code_example } = req.body;
    console.log(`BELLY_AI_KNOWLEDGE: Storing curriculum topic - ${topic}`);
    dbAiOnly.run(
        "INSERT OR REPLACE INTO techstack_knowledge (topic, concept_description, code_example) VALUES (?, ?, ?)",
        [topic, concept_description, code_example],
        function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.get('/ai-only/knowledge', checkInternalAuth, (req, res) => {
    dbAiOnly.all("SELECT * FROM techstack_knowledge ORDER BY timestamp DESC", (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, knowledge: rows });
    });
});

// --- UI CONFIG ENDPOINTS ---
const UI_CONFIG_PATH = path.join(__dirname, '../data/config/ui_config.json');

app.get('/api/ui/config', (req, res) => {
    fs.readFile(UI_CONFIG_PATH, 'utf8', (err, data) => {
        if (err) {
            console.error(`BELLY_UI_ERROR: Could not read ui_config.json: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json(JSON.parse(data));
    });
});

app.post('/api/ui/config', (req, res) => {
    fs.writeFile(UI_CONFIG_PATH, JSON.stringify(req.body, null, 2), 'utf8', (err) => {
        if (err) {
            console.error(`BELLY_UI_ERROR: Could not save ui_config.json: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true });
    });
});

// --- UI LAYOUTS ENDPOINTS ---
const LAYOUTS_DIR = path.join(__dirname, '../data/config/layouts');

app.get('/api/ui/layouts', (req, res) => {
    fs.readdir(LAYOUTS_DIR, (err, files) => {
        if (err) {
            // Create dir if missing
            if (err.code === 'ENOENT') {
                fs.mkdirSync(LAYOUTS_DIR, { recursive: true });
                return res.json({ success: true, layouts: [] });
            }
            return res.status(500).json({ success: false, error: err.message });
        }
        const layouts = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
        res.json({ success: true, layouts });
    });
});

app.post('/api/ui/layouts', (req, res) => {
    const { name, config } = req.body;
    if (!name || !config) return res.status(400).json({ success: false, error: 'Name and config required' });

    // Sanitize filename
    const safeName = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const savePath = path.join(LAYOUTS_DIR, `${safeName}.json`);

    fs.writeFile(savePath, JSON.stringify(config, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, name: safeName });
    });
});

app.post('/api/ui/layout/load', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Layout name required' });

    const safeName = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const loadPath = path.join(LAYOUTS_DIR, `${safeName}.json`);

    fs.access(loadPath, fs.constants.F_OK, (err) => {
        if (err) return res.status(404).json({ success: false, error: 'Layout not found' });

        fs.copyFile(loadPath, UI_CONFIG_PATH, (copyErr) => {
            if (copyErr) return res.status(500).json({ success: false, error: copyErr.message });
            res.json({ success: true, message: `Loaded ${safeName}` });
        });
    });
});

app.get('/api/file/read', (req, res) => {
    const filename = req.query.path;
    if (!filename) return res.status(400).json({ success: false, error: "Path required" });

    // Resolve relative to project root
    const safePath = path.resolve(__dirname, '../', filename);
    if (!safePath.startsWith(path.resolve(__dirname, '../'))) {
        return res.status(403).json({ success: false, error: "Access denied" });
    }

    fs.readFile(safePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, content: data });
    });
});

// --- MACRO RECORDER & BROWSER ENDPOINTS ---
let macroProcess = null;

app.post('/api/macro/record', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Macro name required" });

    console.log(`BELLY_WORKER: Starting macro recorder for '${name}'`);
    const pythonExecutable = path.join(__dirname, '../.venv/bin/python3');
    const recorderScript = path.join(__dirname, '../worker/macro/recorder.py');

    // Kill existing if any
    if (macroProcess) {
        macroProcess.kill('SIGINT');
        macroProcess = null;
    }

    macroProcess = spawn(pythonExecutable, [recorderScript, '--name', name]);

    macroProcess.stdout.on('data', (data) => console.log(`[MACRO] ${data.toString().trim()}`));
    macroProcess.stderr.on('data', (data) => console.error(`[MACRO ERR] ${data.toString().trim()}`));
    macroProcess.on('close', (code) => {
        console.log(`[MACRO] EXITED WITH CODE ${code}`);
        macroProcess = null;
    });

    res.json({ success: true, message: `Recording macro ${name}...` });
});

app.post('/api/macro/stop', (req, res) => {
    console.log(`BELLY_WORKER: Stopping macro recorder`);
    if (macroProcess) {
        macroProcess.kill('SIGINT');
        macroProcess = null;
        res.json({ success: true, message: "Recording stopped." });
    } else {
        res.json({ success: false, message: "No recording in progress." });
    }
});

app.post('/api/browser/open', (req, res) => {
    console.log(`BELLY_WORKER: Launching headed browser context...`);
    // Example hook to open playwright natively
    res.json({ success: true, message: "Browser request acknowledged." });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`STARTUP: MCP Server listening on http://0.0.0.0:${PORT}`);
});
