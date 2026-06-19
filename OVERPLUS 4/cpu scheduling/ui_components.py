# ui_components.py
# ─────────────────────────────────────────────
# Reusable UI helper functions for cards, metrics, and advisory telemetry layouts.

import tkinter as tk

def card(parent, title, bg_card, text_w):
    frame = tk.Frame(parent, bg=bg_card, padx=14, pady=12, relief="flat", bd=0)
    frame.pack(fill="x", pady=(0, 10))
    if title:
        tk.Label(frame, text=title, font=("Segoe UI", 11, "bold"),
                 bg=bg_card, fg=text_w).pack(anchor="w", pady=(0, 8))
    return frame


def metric_card(parent, label, value, color, text_muted, text_w):
    c = tk.Frame(parent, bg=color, padx=14, pady=8)
    c.pack(side="left", padx=5, expand=True, fill="x")
    tk.Label(c, text=label, bg=color, fg=text_muted,
            font=("Segoe UI", 9)).pack(anchor="w")
    tk.Label(c, text=value, bg=color, fg=text_w,
            font=("Segoe UI", 14, "bold")).pack(anchor="w")


def build_table_header(parent, bg_input, text_w):
    """Creates a robust header bar with explicit spacing that aligns with the inputs."""
    hdr = tk.Frame(parent, bg=bg_input)
    hdr.pack(fill="x", pady=(0, 4))
    
    tk.Label(hdr, text="Process", bg=bg_input, fg=text_w, font=("Segoe UI", 9, "bold"), width=7, pady=3, anchor="center").pack(side="left")
    tk.Label(hdr, text="Arrival", bg=bg_input, fg=text_w, font=("Segoe UI", 9, "bold"), width=7, pady=3, anchor="center").pack(side="left", padx=(2, 0))
    tk.Label(hdr, text="Burst", bg=bg_input, fg=text_w, font=("Segoe UI", 9, "bold"), width=7, pady=3, anchor="center").pack(side="left", padx=(4, 0))
    tk.Label(hdr, text="Priority", bg=bg_input, fg=text_w, font=("Segoe UI", 9, "bold"), width=7, pady=3, anchor="center").pack(side="left", padx=(4, 0))


def build_advisor_panel(parent, bg_dark, bg_input, text_w, text_muted, accent2):
    container = tk.Frame(parent, bg=bg_dark, bd=0, relief="flat")
    container.pack(fill="x", pady=(4, 0))
    
    badge_row = tk.Frame(container, bg=bg_dark)
    badge_row.pack(fill="x", pady=(0, 6))
    
    tk.Label(badge_row, text="OPTIMAL CHOICE:", bg=bg_dark, fg=text_muted,
             font=("Segoe UI", 9, "bold")).pack(side="left")
             
    winner_lbl = tk.Label(badge_row, text="WAITING...", bg=accent2, fg=text_w,
                          font=("Segoe UI", 9, "bold"), padx=6, pady=1)
    winner_lbl.pack(side="left", padx=8)
    
    # Inner matrix wrapper
    matrix_frame = tk.Frame(container, bg=bg_input, padx=8, pady=6)
    matrix_frame.pack(fill="x", pady=(0, 8))
    
    # FIXED: Configure 4 exact grid columns so headers and rows stretch identically
    matrix_frame.columnconfigure(0, weight=3, uniform="matrix_col") # Algo name column
    matrix_frame.columnconfigure(1, weight=2, uniform="matrix_col") # AWT column
    matrix_frame.columnconfigure(2, weight=2, uniform="matrix_col") # C-Switch column
    matrix_frame.columnconfigure(3, weight=2, uniform="matrix_col") # Util column
    
    headers = ["ALGO", "AWT", "C-SWITCH", "UTIL"]
    for col_idx, text in enumerate(headers):
        lbl = tk.Label(matrix_frame, text=text, bg=bg_input, fg=text_muted,
                       font=("Segoe UI", 8, "bold"), anchor="w")
        lbl.grid(row=0, column=col_idx, sticky="ew", pady=(0, 4))
                 
    row_frames = []
    # Create the placeholder subframes for each row inside the grid matrix
    for row_idx in range(1, 5):
        r = tk.Frame(matrix_frame, bg=bg_input)
        r.grid(row=row_idx, column=0, columnspan=4, sticky="ew", pady=1)
        
        # Mirror the exact column constraints into each subrow frame
        r.columnconfigure(0, weight=3, uniform="matrix_col")
        r.columnconfigure(1, weight=2, uniform="matrix_col")
        r.columnconfigure(2, weight=2, uniform="matrix_col")
        r.columnconfigure(3, weight=2, uniform="matrix_col")
        row_frames.append(r)
        
    critique_lbl = tk.Label(container, text="Generate processes and execute system advisor mapping routines.",
                            bg=bg_dark, fg=text_w, font=("Segoe UI", 9, "italic"),
                            wraplength=240, justify="left", anchor="w")
    critique_lbl.pack(fill="x", pady=2)
    
    return {
        "winner_lbl": winner_lbl,
        "row_frames": row_frames,
        "critique_lbl": critique_lbl
    }