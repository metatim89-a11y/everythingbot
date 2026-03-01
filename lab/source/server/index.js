// Version: 1.35
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
const crypto = require('crypto');
const { spawn } = require('child_process');
const { body, param, validationResult } = require('express-validator');

// --- AI Configuration (Real-time) ---
let aiConfig = {
    max_new_tokens: 128,
    temperature: 0.7
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
const UPLOADS_DIR = path.join(PROJECT_ROOT_DIR, 'data', 'uploads');
const PROPOSALS_DIR = path.join(PROJECT_ROOT_DIR, 'proposals');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PROPOSALS_DIR)) fs.mkdirSync(PROPOSALS_DIR, { recursive: true });

// --- Persistent DB Connections ---
const dbTraining = new sqlite3.Database(DB_PATH_TRAINING);
const dbAiOnly = new sqlite3.Database(DB_PATH_AI_ONLY);

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
            // Ensure 'archived' column exists in case table was created previously without it
            dbTraining.run("ALTER TABLE chat_sessions ADD COLUMN archived INTEGER DEFAULT 0", (err2) => {
                if (err2 && !err2.message.includes("duplicate column name")) {
                    console.warn(`BELLY_DB_WARN: Could not add 'archived' column: ${err2.message}`);
                }
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
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error(`BELLY_DB_ERROR: Could not create keyword_profiles: ${err.message}`);
        else console.log(`BELLY_DB: Initialized keyword_profiles table.`);
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

// Verbose Request Belly-Trace
app.use((req, res, next) => {
    const start = Date.now();
    console.log(`BELLY_TRACE: Incoming ${req.method} ${req.url}`);
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`BELLY_TRACE: Finished ${req.method} ${req.url} [${res.statusCode}] in ${duration}ms`);
    });
    next();
});

// --- Routes ---

app.get('/health', (req, res) => {
    console.log('BELLY_CHECK: Health probe received.');
    res.json({ status: 'UP', signature: getSignature() });
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
        res.status(500).json({ success: false, error: error.message });
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

    // Spawn the scraper process via the virtual environment
    const scraperScript = path.join(PROJECT_ROOT_DIR, 'worker', 'scraper', 'scraper_core.py');
    const pythonExecutable = path.join(PROJECT_ROOT_DIR, '.venv', 'bin', 'python');
    const pythonProcess = spawn(pythonExecutable, [scraperScript, profile_name]);

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
    const { name, keywords } = req.body;
    console.log(`BELLY_DB: Creating new profile '${name}'`);
    dbTraining.run("INSERT INTO keyword_profiles (name, keywords) VALUES (?, ?)", [name, keywords], function (err) {
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
    dbTraining.all("SELECT * FROM scraped_leads ORDER BY timestamp DESC LIMIT 200", (err, rows) => {
        if (err) {
            console.error(`BELLY_DB_ERROR: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, leads: rows });
    });
});

// --- Path Resolver & Multi-Tenant Sandbox Middleware ---
const DB_VAULT_ROOT = path.join(__dirname, '..', '..', '.sys_cache');

function getDarkVaultDb(username) {
    const hash = crypto.createHash('sha256').update(username).digest('hex').substring(0, 12);
    const targetDir = path.join(DB_VAULT_ROOT, `node_m_0x${hash}`);
    const dbPath = path.join(targetDir, 'runtime.lib.so.db');
    if (!fs.existsSync(targetDir) || !fs.existsSync(dbPath)) {
        return null; // Vault does not exist or hasn't been initialized
    }
    return dbPath;
}

app.get('/api/user/:username/preferences', (req, res) => {
    const { username } = req.params;
    const dbPath = getDarkVaultDb(username);

    if (!dbPath) {
        return res.status(404).json({ success: false, error: 'User vault not found.' });
    }

    console.log(`BELLY_DB: Fetching preferences for dark vault user: ${username}`);
    const userDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) return res.status(500).json({ success: false, error: 'Vault access denied.' });
    });

    userDb.all("SELECT key, value FROM preferences", (err, rows) => {
        userDb.close();
        if (err) return res.status(500).json({ success: false, error: err.message });

        const prefs = {};
        rows.forEach(r => prefs[r.key] = r.value);
        res.json({ success: true, preferences: prefs });
    });
});

app.put('/api/user/:username/preferences', (req, res) => {
    const { username } = req.params;
    const { key, value } = req.body;
    const dbPath = getDarkVaultDb(username);

    if (!dbPath) {
        return res.status(404).json({ success: false, error: 'User vault not found.' });
    }

    if (!key || value === undefined) {
        return res.status(400).json({ success: false, error: 'Key and value are required.' });
    }

    console.log(`BELLY_DB: Updating preference '${key}' for dark vault user: ${username}`);
    const userDb = new sqlite3.Database(dbPath, (err) => {
        if (err) return res.status(500).json({ success: false, error: 'Vault access denied.' });
    });

    userDb.run("INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)", [key, value], function (err) {
        userDb.close();
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, updated: key });
    });
});

// --- Proposals (Autonomous Dev) Routes ---

app.get('/proposals/latest', (req, res) => {
    const taskPath = path.join(PROPOSALS_DIR, 'task.md');
    const proceduresPath = path.join(PROPOSALS_DIR, 'procedures.txt');
    try {
        if (fs.existsSync(taskPath) && fs.existsSync(proceduresPath)) {
            const taskContent = fs.readFileSync(taskPath, 'utf-8');
            const proceduresContent = fs.readFileSync(proceduresPath, 'utf-8');
            res.json({ success: true, has_proposal: true, task: taskContent, procedures: proceduresContent });
        } else {
            res.json({ success: true, has_proposal: false });
        }
    } catch (error) {
        console.error(`BELLY_PROPOSAL_ERROR: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/proposals/approve', (req, res) => {
    const proceduresPath = path.join(PROPOSALS_DIR, 'procedures.txt');
    const taskPath = path.join(PROPOSALS_DIR, 'task.md');

    if (!fs.existsSync(proceduresPath)) {
        return res.status(404).json({ success: false, error: 'No proposal found.' });
    }

    console.log(`BELLY_PROPOSAL: Approving and executing proposal.`);

    // Execute the procedures.txt as a bash script
    const exec = require('child_process').exec;
    exec(`bash ${proceduresPath}`, { cwd: PROJECT_ROOT_DIR }, (error, stdout, stderr) => {
        if (error) {
            console.error(`BELLY_PROPOSAL_EXEC_ERROR: ${error.message}`);
            return res.status(500).json({ success: false, error: error.message, stderr: stderr });
        }
        console.log(`BELLY_PROPOSAL_EXEC_STDOUT: ${stdout}`);

        // Archive
        const archiveDir = path.join(PROPOSALS_DIR, 'archive');
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);
        const timestamp = Date.now();
        fs.renameSync(taskPath, path.join(archiveDir, `task_${timestamp}.md`));
        fs.renameSync(proceduresPath, path.join(archiveDir, `procedures_${timestamp}.txt`));

        res.json({ success: true, message: 'Proposal executed successfully.', stdout, stderr });
    });
});

app.post('/proposals/reject', (req, res) => {
    const proceduresPath = path.join(PROPOSALS_DIR, 'procedures.txt');
    const taskPath = path.join(PROPOSALS_DIR, 'task.md');

    console.log(`BELLY_PROPOSAL: Rejecting proposal.`);

    try {
        // Archive as rejected
        const archiveDir = path.join(PROPOSALS_DIR, 'archive');
        if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);
        const timestamp = Date.now();
        if (fs.existsSync(taskPath)) fs.renameSync(taskPath, path.join(archiveDir, `rejected_task_${timestamp}.md`));
        if (fs.existsSync(proceduresPath)) fs.renameSync(proceduresPath, path.join(archiveDir, `rejected_procedures_${timestamp}.txt`));

        res.json({ success: true, message: 'Proposal rejected.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Database Explorer Routes ---

app.get('/db/tables/:dbName', (req, res) => {
    const db = dbTraining; // Default to training DB now that ai_only is removed
    console.log(`BELLY_DB: Fetching tables for training.db`);
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, tables: rows.map(r => r.name) });
    });
});

app.get('/db/data/:dbName/:tableName', (req, res) => {
    const { tableName } = req.params;
    const db = dbTraining; // Default to training DB now that ai_only is removed
    console.log(`BELLY_DB: Fetching data from training.db [${tableName}]`);
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
app.post('/ai-only/teach', (req, res) => {
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

app.get('/ai-only/knowledge', (req, res) => {
    dbAiOnly.all("SELECT * FROM techstack_knowledge ORDER BY timestamp DESC", (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, knowledge: rows });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`STARTUP: MCP Server listening on http://0.0.0.0:${PORT}`);
});
