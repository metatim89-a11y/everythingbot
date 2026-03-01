# Version: 1.00
import os
import time
import json
import argparse
from pynput import mouse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MACRO_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../../data/config/macros"))

events = []
start_time = None

def on_move(x, y):
    record_event("move", {"x": x, "y": y})

def on_click(x, y, button, pressed):
    record_event("click", {"x": x, "y": y, "button": str(button), "pressed": pressed})

def on_scroll(x, y, dx, dy):
    record_event("scroll", {"x": x, "y": y, "dx": dx, "dy": dy})

def record_event(event_type, params):
    global start_time
    if start_time is None:
        start_time = time.time()
    
    elapsed = time.time() - start_time
    events.append({
        "time": elapsed,
        "type": event_type,
        "params": params
    })

def start_recording(name):
    print(f"Starting macro recorder for: {name}")
    if not os.path.exists(MACRO_DIR):
        os.makedirs(MACRO_DIR)
        
    global start_time
    start_time = time.time()
    
    # Start listening to the mouse
    listener = mouse.Listener(
        on_move=on_move,
        on_click=on_click,
        on_scroll=on_scroll)
    listener.start()
    
    try:
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        # Save on exit (e.g. SIGINT from node server)
        listener.stop()
        save_path = os.path.join(MACRO_DIR, f"{name}.json")
        with open(save_path, "w") as f:
            json.dump(events, f, indent=2)
        print(f"Saved {len(events)} events to {save_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True)
    args = parser.parse_args()
    start_recording(args.name)
