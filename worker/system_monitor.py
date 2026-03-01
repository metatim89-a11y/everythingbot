# Version: 1.00
"""
System Monitor Utility for everythingbot.
Polls backend metrics and logs structured health reports.
"""

import os
import time
import json
import requests
from datetime import datetime

# Pathing
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
LOG_FILE = os.path.join(PROJECT_ROOT, ".hidden", "LOGS", "system_health.log")

METRICS_URL = "http://localhost:3000/api/system/metrics"

def get_signature():
    now = datetime.now()
    sig_date = now.strftime('%b/%d/%y/%I:%M%p').lower()
    return f"{{{{geminiCLI/system-monitor {sig_date}}}}}"

def log_health_report():
    print(f"--- System Health Report [{datetime.now().isoformat()}] ---")
    try:
        res = requests.get(METRICS_URL, timeout=5)
        data = res.json()
        
        if data.get("success"):
            app = data["app"]
            os_stats = data["os"]
            
            report = (
                f"STATUS: HEALTHY
"
                f"UPTIME: {app['uptime']}s
"
                f"CPU USAGE: {os_stats['cpuUsage']:.1f}%
"
                f"ACTIVE CONNS: {app['activeConnections']}
"
                f"AVG LATENCY: {app['avgLatencyMs']}ms
"
                f"ERRORS: {app['errorCount']}
"
            )
            
            if app.get("lastBottleNeck"):
                bn = app["lastBottleNeck"]
                report += f"LAST BOTTLENECK: {bn['route']} ({bn['duration']}ms)
"
            
            report += f"SIGNATURE: {get_signature()}
"
            
            with open(LOG_FILE, "a") as f:
                f.write(f"
--- {datetime.now().isoformat()} ---
{report}")
            
            print(report)
        else:
            print("FAILED: Backend returned success=false")
            
    except Exception as e:
        print(f"ERROR: Could not connect to metrics API: {e}")

if __name__ == "__main__":
    print("Starting System Monitor (60s intervals)...")
    while True:
        log_health_report()
        time.sleep(60)
