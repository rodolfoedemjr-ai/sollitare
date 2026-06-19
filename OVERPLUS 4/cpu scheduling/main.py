# main.py
# ─────────────────────────────────────────────
# Main GUI app — imports algorithms, advisor, and UI components.
# Patched for double-buffered, flicker-free canvas animations and grid column matrix alignments.

import tkinter as tk
from tkinter import ttk, messagebox
from dataclasses import dataclass
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import random


from algorithms import fcfs, sjf, priority_algo, round_robin, compute_stats
from advisor import smart_advisor
from ui_components import card, metric_card, build_table_header, build_advisor_panel

# Colors
BG_DARK   = "#1a1a2e"
BG_CARD   = "#16213e"
BG_INPUT  = "#0f3460"
ACCENT    = "#533483"
ACCENT2   = "#e94560"
TEXT_W    = "#eaeaea"
TEXT_MUTED= "#9aa2b0"
SUCCESS   = "#2E2C7A"

PROC_COLORS = [
    "#7b5ea7", "#2d6a4f", "#c0392b", "#1a6985",
    "#c0782a", "#2e4053", "#6d4c41", "#1b5e20",
    "#4a148c", "#006064"
]

@dataclass
class ProcessRowUI:
    name: str
    arrival_var: tk.StringVar
    burst_var: tk.StringVar
    priority_var: tk.StringVar
    
    def get_data_payload(self):
        try:
            return {
                "name": self.name,
                "at": int(self.arrival_var.get() if self.arrival_var.get() != "" else 0),
                "bt": int(self.burst_var.get() if self.burst_var.get() != "" else 1),
                "pr": int(self.priority_var.get() if self.priority_var.get() != "" else 1)
            }
        except ValueError:
            return {"name": self.name, "at": 0, "bt": 1, "pr": 1}


class ScrollableFrame(tk.Frame):
    def __init__(self, container, *args, **kwargs):
        super().__init__(container, *args, **kwargs)
        self.configure(bg=BG_CARD)

        self.style = ttk.Style()
        self.style.theme_use("clam")
        self.style.configure(
            "Dark.Vertical.TScrollbar",
            background=BG_INPUT, troughcolor=BG_CARD, arrowcolor=TEXT_W,
            bordercolor=BG_CARD, lightcolor=BG_CARD, darkcolor=BG_CARD         
        )

        self.canvas = tk.Canvas(self, bg=BG_CARD, highlightthickness=0, borderwidth=0, width=280)
        self.scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview, style="Dark.Vertical.TScrollbar")
        self.scrollable_frame = tk.Frame(self.canvas, bg=BG_CARD)

        self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw", width=280)
        self.canvas.configure(yscrollcommand=self.scrollbar.set)

        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack_forget()

        def _on_mousewheel(event):
            canvas_h = self.canvas.winfo_height()
            content_h = self.scrollable_frame.winfo_height()
            if content_h <= canvas_h: return  
            self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

        self.canvas.bind("<Enter>", lambda e: self.canvas.bind_all("<MouseWheel>", _on_mousewheel))
        self.canvas.bind("<Leave>", lambda e: self.canvas.unbind_all("<MouseWheel>"))

    def recalculate_layout(self):
        self.update_idletasks()
        self.scrollable_frame.update_idletasks()
        content_height = self.scrollable_frame.winfo_height()
        canvas_height = self.canvas.winfo_height()
        self.canvas.configure(scrollregion=(0, 0, 280, content_height))
        if content_height <= canvas_height or canvas_height <= 10:
            self.scrollbar.pack_forget()
            self.canvas.yview_moveto(0.0)
        else:
            self.scrollbar.pack(side="right", fill="y")


class CPUSchedulerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("CPU Scheduling Simulator")
        self.root.geometry("1200x850")  
        self.root.configure(bg=BG_DARK)
        self.root.resizable(True, True)

        self.entries = []
        self.proc_count = 0
        self.canvas_widget = None

        # Persistent Plot Containers
        self.fig = None
        self.ax = None

        # Live Playback State Vectors
        self.is_playing = False
        self.current_frame_time = 0
        self.max_simulation_time = 0
        self.playback_after_id = None
        self.active_animation_chart = []
        self.active_animation_data = []
        self.active_animation_title = ""

        self._build_ui()
        self.root.after(100, self.scrollable_container.recalculate_layout)

        # ─────────────────────────────────────────────────────────────────────────────
        # TRIGGER FOR THE INTRO OVERLAY
        # Remove or comment out the line below to disable the intro completely.
        # ─────────────────────────────────────────────────────────────────────────────
        self.root.after(150, self._start_intro_sequence)

    def _only_digits(self, char):
        return char.isdigit() or char == ""

    # ─────────────────────────────────────────────────────────────────────────────
    # ██████████████████████ START OF INTRO SEQUENCE FEATURE ██████████████████████
    # ─────────────────────────────────────────────────────────────────────────────
    def _start_intro_sequence(self):
        """Simulates a professional hardware motherboard layout with realistic orthogonal data flows."""
        # Deep charcoal industrial engineering palette setup
        self.intro_overlay = tk.Frame(self.root, bg="#0f141c") 
        self.intro_overlay.place(relx=0, rely=0, relwidth=1, relheight=1)
        
        # Micro-grid background layer canvas
        self.ai_canvas = tk.Canvas(self.intro_overlay, bg="#0f141c", highlightthickness=0)
        self.ai_canvas.pack(fill="both", expand=True)

        self.loading_pct = 0
        self.clock_cycle = 0
        self.active_signals = [] # Tracks running wavefronts: {"points": [...], "progress": float}
        
        # Color matrix matching clean hardware schematics
        self.sig_high = "#388bfd"  # Energized trace line
        self.sig_low  = "#1e222a"  # Dormant background copper path

        self._animate_digital_logic()

    def _animate_digital_logic(self):
        """Maintains clean, step-precise clock execution logic and signal wave propagation loops."""
        if not hasattr(self, 'intro_overlay') or not self.intro_overlay.winfo_exists():
            return

        self.ai_canvas.delete("all")
        
        # Compute dynamic canvas scaling properties 
        W = self.ai_canvas.winfo_width()
        H = self.ai_canvas.winfo_height()
        if W <= 10: W, H = 1200, 850
        cx, cy = W // 2, H // 2

        self.clock_cycle += 1

        # ───  DRAW SUBTLE PCB SCHEMATIC GRID ────────────────────────────────
        grid_space = 25
        for x in range(0, W, grid_space):
            self.ai_canvas.create_line(x, 0, x, H, fill="#141922", width=1)
        for y in range(0, H, grid_space):
            self.ai_canvas.create_line(0, y, W, y, fill="#141922", width=1)

        # ───  DEFINED FIXED METRIC BUS COURIER TRACKS ───────────────────────
        # Rigorous 90-degree data traces simulating parallel buses routing out of core pins
        cpu_w = 45  # Keeps it as a standard, non-oversized square
        
        bus_routes = [
            # Right Channels (Lane A & B)
            [(cx + cpu_w, cy - 15), (cx + cpu_w + 120, cy - 15), (cx + cpu_w + 120, cy - 140), (W - 100, cy - 140)],
            [(cx + cpu_w, cy + 15), (cx + cpu_w + 90, cy + 15), (cx + cpu_w + 90, cy + 140), (W - 100, cy + 140)],
            # Left Channels (Lane A & B)
            [(cx - cpu_w, cy - 15), (cx - cpu_w - 120, cy - 15), (cx - cpu_w - 120, cy - 140), (100, cy - 140)],
            [(cx - cpu_w, cy + 15), (cx - cpu_w - 90, cy + 15), (cx - cpu_w - 90, cy + 140), (100, cy + 140)],
            # Vertical Ground / Timing Channels
            [(cx - 20, cy + cpu_w), (cx - 20, cy + cpu_w + 60), (cx - 160, cy + cpu_w + 60), (cx - 160, H - 120)],
            [(cx + 20, cy + cpu_w), (cx + 20, cy + cpu_w + 60), (cx + 160, cy + cpu_w + 60), (cx + 160, H - 120)]
        ]

        # ───  CLOCK TICK TRIGGER GENERATOR ──────────────────────────────────
        # Every 25 cycles, a new data execution packet leaves the CPU pins
        if self.clock_cycle % 25 == 1 and self.loading_pct < 100:
            for route in bus_routes:
                self.active_signals.append({"points": route, "progress": 0.0})

        # ───  RENDER STATIONARY BACKGROUND TRACES ───────────────────────────
        for route in bus_routes:
            for i in range(len(route) - 1):
                self.ai_canvas.create_line(route[i][0], route[i][1], route[i+1][0], route[i+1][1], 
                                            fill=self.sig_low, width=2)

        # ───  COMPUTE & RENDER RUNNING WAVEFRONTS ───────────────────────────
        updated_signals = []
        for sig in self.active_signals:
            sig["progress"] += 0.025  # Controlled, uniform data transfer velocity
            if sig["progress"] <= 1.0:
                pts = sig["points"]
                total_segments = len(pts) - 1
                
                # Determine precise active segment index down the bus lane
                seg_idx = min(int(sig["progress"] * total_segments), total_segments - 1)
                seg_pct = (sig["progress"] * total_segments) - seg_idx
                
                # Trace back and light up everything from origin to current position
                for j in range(seg_idx):
                    self.ai_canvas.create_line(pts[j][0], pts[j][1], pts[j+1][0], pts[j+1][1], 
                                                fill=self.sig_high, width=2)
                
                # Smoothly interpolate exact line location tip points
                x1, y1 = pts[seg_idx]
                x2, y2 = pts[seg_idx + 1]
                curr_x = x1 + int((x2 - x1) * seg_pct)
                curr_y = y1 + int((y2 - y1) * seg_pct)
                
                self.ai_canvas.create_line(x1, y1, curr_x, curr_y, fill=self.sig_high, width=2)
                
                # Micro square data pin node indicator right at the signal wavefront tip
                self.ai_canvas.create_rectangle(curr_x - 2, curr_y - 2, curr_x + 2, curr_y + 2, 
                                                fill="#ffffff", outline=self.sig_high, width=1)
                updated_signals.append(sig)
                
        self.active_signals = updated_signals

        # ───  DRAW THE CPU MODULE BLOCK ─────────────────────────────────────
        # Crisp, ordinary square geometry
        self.ai_canvas.create_rectangle(cx - cpu_w, cy - cpu_w, cx + cpu_w, cy + cpu_w, 
                                        fill="#161b22", outline="#30363d", width=2)
        # Clear, clean monospace font representation
        self.ai_canvas.create_text(cx, cy, text="CPU", font=("Consolas", 11, "bold"), fill="#f0f6fc")

        # ───  TRACK PROGRESS TELEMETRY OVERLAYS ─────────────────────────────
        if self.loading_pct < 100:
            self.loading_pct += 0.5
            status_text = f"ANALYZING MEMORY BUS CHANNELS... {int(self.loading_pct)}%"
        else:
            status_text = "INSTRUCTION ENVIRONMENT READY."

        self.ai_canvas.create_text(cx, cy + cpu_w + 30, text=status_text, 
                                   font=("Consolas", 8, "bold"), fill="#8b949e", justify="center")

        # ───  INTERACTIVE WORKLOAD LAUNCHER INTERACTION ─────────────────────
        if self.loading_pct >= 100:
            if not hasattr(self, 'start_btn'):
                self.start_btn = tk.Button(self.intro_overlay, text="LAUNCH SIMULATION DASHBOARD", 
                                           command=self._dismiss_intro, bg="#238636", fg="#ffffff", 
                                           activebackground="#2ea043", activeforeground="#ffffff",
                                           relief="flat", font=("Segoe UI", 9, "bold"), padx=18, pady=6, cursor="hand2")
                self.start_btn.place(relx=0.5, rely=0.66, anchor="center")

        # Run render sequence ticks at a steady 30 FPS (~33ms intervals)
        self.playback_after_id = self.root.after(33, self._animate_digital_logic)

    def _dismiss_intro(self):
        """Safely tears down the splash frame vectors to bring forward the main cockpit view."""
        if hasattr(self, 'intro_overlay') and self.intro_overlay.winfo_exists():
            self.intro_overlay.destroy()
            self._generate()
    # ─────────────────────────────────────────────────────────────────────────────
    # ███████████████████████ END OF INTRO SEQUENCE FEATURE ███████████████████████
    # ─────────────────────────────────────────────────────────────────────────────

    def _build_ui(self):
        title_bar = tk.Frame(self.root, bg=ACCENT, pady=10)
        title_bar.pack(fill="x")
        tk.Label(title_bar, text="⚙  CPU Scheduling Simulator",
                 font=("Segoe UI", 16, "bold"), bg=ACCENT, fg=TEXT_W).pack()

        outer = tk.Frame(self.root, bg=BG_DARK)
        outer.pack(fill="both", expand=True, padx=16, pady=12)

        self.scrollable_container = ScrollableFrame(outer)
        self.scrollable_container.pack(side="left", fill="y", padx=(0, 12), anchor="n")
        self.left = self.scrollable_container.scrollable_frame

        self.right = tk.Frame(outer, bg=BG_DARK)
        self.right.pack(side="left", fill="both", expand=True)
        
        self.right.grid_rowconfigure(0, weight=0)  
        self.right.grid_rowconfigure(1, weight=3)  
        self.right.grid_rowconfigure(2, weight=2)  
        self.right.grid_columnconfigure(0, weight=1)

        self._build_left()
        self._build_right()

    def _build_left(self):
        vcmd = (self.root.register(self._only_digits), '%S')

        c1 = card(self.left, "Setup", BG_CARD, TEXT_W)
        row = tk.Frame(c1, bg=BG_CARD)
        row.pack(fill="x")
        tk.Label(row, text="Processes (1–10):", bg=BG_CARD, fg=TEXT_MUTED, font=("Segoe UI", 10)).pack(side="left")
        
        self.n_var = tk.StringVar(value="5")
        e = tk.Entry(row, textvariable=self.n_var, width=5, bg=BG_INPUT, fg=TEXT_W, insertbackground=TEXT_W, relief="flat", font=("Segoe UI", 10), validate="key", validatecommand=vcmd)
        e.pack(side="left", padx=8)
        
        tk.Button(row, text="Generate", command=self._generate, bg=ACCENT, fg=TEXT_W, relief="flat", cursor="hand2", font=("Segoe UI", 9, "bold"), padx=10).pack(side="left")

        self.table_card = card(self.left, "Process parameters", BG_CARD, TEXT_W)
        build_table_header(self.table_card, BG_INPUT, TEXT_W)

        self.table_body = tk.Frame(self.table_card, bg=BG_CARD)
        self.table_body.pack(fill="x")

        c2 = card(self.left, "Round Robin", BG_CARD, TEXT_W)
        qrow = tk.Frame(c2, bg=BG_CARD)
        qrow.pack(fill="x")
        tk.Label(qrow, text="Time quantum:", bg=BG_CARD, fg=TEXT_MUTED, font=("Segoe UI", 10)).pack(side="left")
        
        self.q_var = tk.StringVar(value="2")
        tk.Entry(qrow, textvariable=self.q_var, width=5, bg=BG_INPUT, fg=TEXT_W, insertbackground=TEXT_W, relief="flat", font=("Segoe UI", 10), validate="key", validatecommand=vcmd).pack(side="left", padx=8)

        c3 = card(self.left, "Run algorithm", BG_CARD, TEXT_W)
        algos = [("FCFS", "#2d6a4f"), ("SJF", "#1a6985"), ("Priority", "#6d4c41"), ("Round Robin", "#7b5ea7")]
        for name, color in algos:
            tk.Button(c3, text=name, command=lambda a=name: self._run(a), bg=color, fg=TEXT_W, relief="flat", cursor="hand2", font=("Segoe UI", 10, "bold"), padx=12, pady=5, width=18).pack(fill="x", pady=2)

        tk.Button(c3, text="🧠  Smart Advisor", command=self._run_advisor, bg=ACCENT2, fg=TEXT_W, relief="flat", cursor="hand2", font=("Segoe UI", 10, "bold"), padx=12, pady=6, width=18).pack(fill="x", pady=(8, 2))

        self.advisor_ui = build_advisor_panel(c3, BG_CARD, BG_INPUT, TEXT_W, TEXT_MUTED, ACCENT2)

    def _build_right(self):
        self.metrics_frame = tk.Frame(self.right, bg=BG_DARK)
        self.metrics_frame.grid(row=0, column=0, pady=(0, 8), sticky="ew")

        self.gantt_frame = tk.Frame(self.right, bg=BG_CARD, relief="flat", bd=0)
        self.gantt_frame.grid(row=1, column=0, pady=(0, 8), sticky="nsew")
        
        self.gantt_placeholder = tk.Label(self.gantt_frame, text="Run an algorithm to see the Gantt chart", bg=BG_CARD, fg=TEXT_MUTED, font=("Segoe UI", 11, "italic"))
        self.gantt_placeholder.pack(expand=True)

        self.controls_frame = tk.Frame(self.right, bg=BG_DARK, pady=4)
        self.controls_frame.grid(row=1, column=0, sticky="s", pady=(0, 12))
        self.controls_frame.grid_remove() 

        self.btn_play = tk.Button(self.controls_frame, text="▶ Play", command=self._toggle_playback, bg=SUCCESS, fg=TEXT_W, font=("Segoe UI", 9, "bold"), relief="flat", padx=10, cursor="hand2")
        self.btn_play.pack(side="left", padx=4)

        tk.Button(self.controls_frame, text="⏮ Reset", command=self._reset_playback, bg=BG_INPUT, fg=TEXT_W, font=("Segoe UI", 9), relief="flat", padx=10, cursor="hand2").pack(side="left", padx=4)

        tk.Label(self.controls_frame, text="Speed:", bg=BG_DARK, fg=TEXT_MUTED, font=("Segoe UI", 9)).pack(side="left", padx=(12, 2))
        self.speed_slider = tk.Scale(self.controls_frame, from_=100, to=1500, orient="horizontal", bg=BG_DARK, fg=TEXT_W, highlightthickness=0, troughcolor=BG_INPUT, showvalue=False, length=100)
        self.speed_slider.set(500)
        self.speed_slider.pack(side="left", padx=4)

        self.time_lbl = tk.Label(self.controls_frame, text="Time: 0s", bg=BG_DARK, fg=ACCENT2, font=("Segoe UI", 10, "bold"), width=10, anchor="e")
        self.time_lbl.pack(side="left", padx=10)

        self.stats_frame = tk.Frame(self.right, bg=BG_CARD)
        self.stats_frame.grid(row=2, column=0, sticky="nsew")

    def _generate(self):
        """Generates process row forms with highly dynamic, completely randomized scheduling boundaries."""
        try:
            n = int(self.n_var.get() if self.n_var.get() != "" else 0)
            if not 1 <= n <= 10: raise ValueError
        except ValueError:
            messagebox.showerror("Input error", "Enter a whole number from 1 to 10.")
            return

        for w in self.table_body.winfo_children(): w.destroy()
        self.entries.clear()
        self.proc_count = n
        vcmd = (self.root.register(self._only_digits), '%S')

        # FORCE TRUE RANDOMIZATION: Ensure arrival times include gaps to test CPU idle states
        generated_arrivals = [0]  # Guarantee at least one process arrives at 0
        for _ in range(n - 1):
            generated_arrivals.append(random.randint(0, 8))
        generated_arrivals.sort() # Sorted arrivals mimic cleaner testing sets

        for i in range(n):
            row = tk.Frame(self.table_body, bg=BG_CARD)
            row.pack(fill="x", pady=1)
            color = PROC_COLORS[i % len(PROC_COLORS)]
            
            tk.Label(row, text=f"P{i+1}", bg=color, fg=TEXT_W, font=("Segoe UI", 9, "bold"), width=7, pady=3, anchor="center").pack(side="left")

            # Assigned randomized value tokens
            at_v = tk.StringVar(value=str(generated_arrivals[i]))
            bt_v = tk.StringVar(value=str(random.randint(1, 10))) # Burst limits scale 1-10
            pr_v = tk.StringVar(value=str(random.randint(1, 5)))  # Priority numbers scale 1-5

            tk.Entry(row, textvariable=at_v, width=7, bg=BG_INPUT, fg=TEXT_W, insertbackground=TEXT_W, relief="flat", font=("Segoe UI", 9), justify="center", validate="key", validatecommand=vcmd).pack(side="left", padx=(3, 0))
            tk.Entry(row, textvariable=bt_v, width=7, bg=BG_INPUT, fg=TEXT_W, insertbackground=TEXT_W, relief="flat", font=("Segoe UI", 9), justify="center", validate="key", validatecommand=vcmd).pack(side="left", padx=(4, 0))
            tk.Entry(row, textvariable=pr_v, width=7, bg=BG_INPUT, fg=TEXT_W, insertbackground=TEXT_W, relief="flat", font=("Segoe UI", 9), justify="center", validate="key", validatecommand=vcmd).pack(side="left", padx=(4, 0))

            self.entries.append(ProcessRowUI(name=f"P{i+1}", arrival_var=at_v, burst_var=bt_v, priority_var=pr_v))

        self.advisor_ui["winner_lbl"].configure(text="WAITING...", bg=ACCENT2)
        self.advisor_ui["critique_lbl"].configure(text="Telemetry randomized. Pending metrics calculation sweeps...", font=("Segoe UI", 9, "italic"))
        for frame in self.advisor_ui["row_frames"]:
            for child in frame.winfo_children(): child.destroy()

        self._clear_results()
        self.root.after(60, self.scrollable_container.recalculate_layout)

    def _collect_data(self):
        data = []
        for entry in self.entries:
            payload = entry.get_data_payload()
            if payload["bt"] < 1:
                messagebox.showerror("Input error", f"{payload['name']}: Burst time must be ≥ 1.")
                return None
            data.append(payload)
        return data

    def _run(self, algo):
        if not self.entries:
            messagebox.showwarning("No processes", "Click 'Generate' first.")
            return
        data = self._collect_data()
        if data is None: return

        try:
            q = int(self.q_var.get() if self.q_var.get() != "" else 2)
            if q < 1: raise ValueError
        except ValueError: q = 2

        if algo == "FCFS": chart, label = fcfs(data), "FCFS"
        elif algo == "SJF": chart, label = sjf(data), "SJF (Non-preemptive)"
        elif algo == "Priority": chart, label = priority_algo(data), "Priority (Non-preemptive)"
        else: chart, label = round_robin(data, q), f"Round Robin  (q = {q})"

        stats = compute_stats(data, chart)
        self._show_metrics(stats, label)
        self._show_stats_table(stats)

        if self.playback_after_id:
            self.root.after_cancel(self.playback_after_id)
            self.playback_after_id = None
            
        self.is_playing = False
        self.btn_play.configure(text="▶ Play", bg=SUCCESS)
        
        self.current_frame_time = 0
        self.max_simulation_time = max(end for (_, _, end) in chart) if chart else 0
        self.active_animation_chart = chart
        self.active_animation_data = data
        self.active_animation_title = label

        if self.gantt_placeholder and self.gantt_placeholder.winfo_exists():
            self.gantt_placeholder.destroy()

        self._init_persistent_canvas()
        
        self.controls_frame.grid() 
        self._render_gantt_step()  
        self.root.after(60, self.scrollable_container.recalculate_layout)

    def _toggle_playback(self):
        if self.is_playing:
            self.is_playing = False
            self.btn_play.configure(text="▶ Play", bg=SUCCESS)
            if self.playback_after_id:
                self.root.after_cancel(self.playback_after_id)
                self.playback_after_id = None
        else:
            self.is_playing = True
            self.btn_play.configure(text="⏸ Pause", bg="#d9534f")
            self._playback_loop()

    def _reset_playback(self):
        if self.playback_after_id:
            self.root.after_cancel(self.playback_after_id)
            self.playback_after_id = None
        self.is_playing = False
        self.btn_play.configure(text="▶ Play", bg=SUCCESS)
        self.current_frame_time = 0
        self._render_gantt_step()

    def _playback_loop(self):
        if not self.is_playing: return
        if self.current_frame_time >= self.max_simulation_time:
            self.is_playing = False
            self.btn_play.configure(text="▶ Play", bg=SUCCESS)
            return

        self.current_frame_time += 1
        self._render_gantt_step()
        
        delay = max(50, 1600 - self.speed_slider.get())
        self.playback_after_id = self.root.after(delay, self._playback_loop)

    def _init_persistent_canvas(self):
        """Creates the frame container figure exactly once to secure dark pixels against white flashes."""
        if self.canvas_widget: return  

        self.fig, self.ax = plt.subplots(figsize=(8, 2.5))
        self.fig.patch.set_facecolor(BG_CARD)
        self.ax.set_facecolor(BG_CARD)
        
        self.fig.tight_layout()
        self.fig.subplots_adjust(left=0.08, right=0.95, top=0.85, bottom=0.18)

        canvas = FigureCanvasTkAgg(self.fig, master=self.gantt_frame)
        self.canvas_widget = canvas.get_tk_widget()
        self.canvas_widget.configure(bg=BG_CARD, highlightthickness=0)
        self.canvas_widget.pack(fill="both", expand=True)

    def _render_gantt_step(self):
        """Executes interior canvas flushes without reconstructing windows to completely eliminate flash flickering."""
        if not self.ax: return

        self.time_lbl.configure(text=f"Time: {self.current_frame_time}s")
        self.ax.clear()  

        chart = self.active_animation_chart
        data = self.active_animation_data
        title = self.active_animation_title

        proc_names = [p["name"] for p in data]
        color_map = {p["name"]: PROC_COLORS[i % len(PROC_COLORS)] for i, p in enumerate(data)}
        bar_h, y_pos = 0.55, {name: i for i, name in enumerate(proc_names)}

        # --- 1. DYNAMIC CPU IDLE DETECTION AND VISUALIZATION ---
        idle_segments = []
        timeline_cursor = 0
        sorted_blocks = sorted(chart, key=lambda x: x[1])

        for (pname, start, end) in sorted_blocks:
            if start > timeline_cursor:
                idle_segments.append((timeline_cursor, start))
            timeline_cursor = max(timeline_cursor, end)

        for (start, end) in idle_segments:
            if start >= self.current_frame_time: continue
            render_end = min(end, self.current_frame_time)
            if render_end - start <= 0: continue
            
            for y_idx in range(len(proc_names)):
                self.ax.barh(y_idx, render_end - start, left=start, height=bar_h,
                             color="#4a0e17", edgecolor="#e94560", linewidth=0.8,
                             hatch="\\\\\\", alpha=0.8)
                if y_idx == 0 and (render_end - start > 0.8):
                    self.ax.text((start + render_end)/2, -0.4, "CPU IDLE", ha="center", va="top", fontsize=7, color="#e94560", fontweight="bold")

        # --- 2. STEP-CROPPED PROCESS RENDERING ---
        for (pname, start, end) in chart:
            if start >= self.current_frame_time: continue 
            render_end = min(end, self.current_frame_time)
            
            y = y_pos[pname]
            self.ax.barh(y, render_end - start, left=start, height=bar_h, color=color_map[pname], edgecolor="#ffffff20", linewidth=0.5)
            
            if render_end - start > 0.8:
                self.ax.text((start + render_end) / 2, y, f"{render_end - start}", ha="center", va="center", fontsize=8, color="white", fontweight="bold")

        # --- 3. GRAPH PLOTTING METRICS WRAPPER ---
        all_times = sorted({t for (_, s, e) in chart for t in (s, e)} | {self.current_frame_time})
        self.ax.set_xticks(all_times)
        self.ax.set_xticklabels([str(t) for t in all_times], fontsize=8, color=TEXT_MUTED)
        self.ax.set_yticks(range(len(proc_names)))
        self.ax.set_yticklabels(proc_names, fontsize=9, color=TEXT_W)
        self.ax.set_xlabel("Timeline (Seconds)", color=TEXT_MUTED, fontsize=9)
        self.ax.set_title(f"Live Playback — {title}", color=TEXT_W, fontsize=10, pad=8)

        self.ax.axvline(x=self.current_frame_time, color=ACCENT2, linestyle=":", linewidth=1.5, alpha=0.8)

        for spine in self.ax.spines.values(): spine.set_edgecolor("#333355")
        self.ax.tick_params(colors=TEXT_MUTED)
        self.ax.grid(axis="x", color="#333355", linestyle="--", linewidth=0.5)
        self.ax.set_xlim(left=0, right=max(all_times) + 1 if all_times else 10)

        patches = [mpatches.Patch(color=color_map[p], label=p) for p in proc_names]
        if idle_segments:
            patches.append(mpatches.Patch(facecolor="#4a0e17", edgecolor="#e94560", hatch="\\\\", label="CPU Idle Gap"))
            
        self.ax.legend(handles=patches, loc="upper right", facecolor=BG_DARK, edgecolor="#333355", labelcolor=TEXT_W, fontsize=8, ncol=min(6, len(patches)))

        self.fig.canvas.draw_idle()

    def _run_advisor(self):
        if not self.entries:
            messagebox.showwarning("No processes", "Click 'Generate' first.")
            return
        data = self._collect_data()
        if data is None: return

        report = smart_advisor(data)
        if not report: return

        self.advisor_ui["winner_lbl"].configure(text=report["choice"].upper(), bg=SUCCESS)
        self.advisor_ui["critique_lbl"].configure(text=report["critique"], font=("Segoe UI", 9, "normal"))

        for idx, (name, awt, sw, util) in enumerate(report["matrix"]):
            target_frame = self.advisor_ui["row_frames"][idx]
            for child in target_frame.winfo_children(): child.destroy()
            
            txt_color = "#ffffff" if report["choice"] in name or (name == "Priority" and report["choice"] == "Priority") else TEXT_W
            font_weight = "bold" if txt_color == "#ffffff" else "normal"

            # FIXED: Deploying grid matrix locks vertical column headers perfectly down with zero drifting!
            tk.Label(target_frame, text=name, bg=BG_INPUT, fg=txt_color, font=("Segoe UI", 8, font_weight), anchor="w").grid(row=0, column=0, sticky="ew")
            tk.Label(target_frame, text=f"{awt:.1f}", bg=BG_INPUT, fg=txt_color, font=("Segoe UI", 8, font_weight), anchor="w").grid(row=0, column=1, sticky="ew")
            tk.Label(target_frame, text=f"{sw}", bg=BG_INPUT, fg=txt_color, font=("Segoe UI", 8, font_weight), anchor="w").grid(row=0, column=2, sticky="ew")
            tk.Label(target_frame, text=f"{util:.0f}%", bg=BG_INPUT, fg=txt_color, font=("Segoe UI", 8, font_weight), anchor="w").grid(row=0, column=3, sticky="ew")

        self._run(report["choice"])

    def _clear_results(self):
        self.controls_frame.grid_remove() 
        for w in self.metrics_frame.winfo_children(): w.destroy()
        for w in self.gantt_frame.winfo_children(): w.destroy()
        for w in self.stats_frame.winfo_children(): w.destroy()
        
        self.gantt_placeholder = tk.Label(self.gantt_frame, text="Run an algorithm to see the Gantt chart", bg=BG_CARD, fg=TEXT_MUTED, font=("Segoe UI", 11, "italic"))
        self.gantt_placeholder.pack(expand=True)
        
        if self.canvas_widget:
            plt.close("all")
            self.canvas_widget = None
            self.fig = None
            self.ax = None

    def _show_metrics(self, stats, algo_label):
        for w in self.metrics_frame.winfo_children(): w.destroy()
        avg_wt  = sum(s["wt"]  for s in stats) / len(stats)
        avg_tat = sum(s["tat"] for s in stats) / len(stats)
        metric_card(self.metrics_frame, "Algorithm", algo_label, ACCENT, TEXT_MUTED, TEXT_W)
        metric_card(self.metrics_frame, "Avg waiting time", f"{avg_wt:.2f}", SUCCESS, TEXT_MUTED, TEXT_W)
        metric_card(self.metrics_frame, "Avg turnaround time", f"{avg_tat:.2f}", BG_INPUT, TEXT_MUTED, TEXT_W)
        metric_card(self.metrics_frame, "Processes", str(len(stats)), "#4a148c", TEXT_MUTED, TEXT_W)

    def _show_stats_table(self, stats):
        for w in self.stats_frame.winfo_children(): w.destroy()

        cols = ("Process", "Arrival", "Burst", "Completion", "Turnaround", "Waiting")
        style = ttk.Style()
        style.theme_use("clam")
        
        style.configure("Dark.Treeview", background=BG_CARD, fieldbackground=BG_CARD, foreground=TEXT_W, rowheight=24, font=("Segoe UI", 9), borderwidth=0)
        style.configure("Dark.Treeview.Heading", background=BG_INPUT, foreground=TEXT_W, font=("Segoe UI", 9, "bold"), relief="flat", borderwidth=0)
        style.map("Dark.Treeview", background=[("selected", ACCENT)], foreground=[("selected", TEXT_W)])

        table_container = tk.Frame(self.stats_frame, bg=BG_CARD)
        table_container.pack(fill="both", expand=True, padx=4, pady=4)

        tree = ttk.Treeview(table_container, columns=cols, show="headings", height=6, style="Dark.Treeview")
        scrollbar = ttk.Scrollbar(table_container, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        
        for col in cols:
            tree.heading(col, text=col)
            tree.column(col, width=100, anchor="center")

        avg_wt  = sum(s["wt"]  for s in stats) / len(stats)
        avg_tat = sum(s["tat"] for s in stats) / len(stats)

        for i, s in enumerate(stats):
            tag = "even" if i % 2 == 0 else "odd"
            tree.insert("", "end", values=(s["name"], s["at"], s["bt"], s["completion"], s["tat"], s["wt"]), tags=(tag,))
        tree.tag_configure("even", background=BG_CARD)
        tree.tag_configure("odd",  background="#1c2a45")

        tree.insert("", "end", values=("Average", "—", "—", "—", f"{avg_tat:.2f}", f"{avg_wt:.2f}"), tags=("avg",))
        tree.tag_configure("avg", background=ACCENT, foreground=TEXT_W)

        tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")


if __name__ == "__main__":
    root = tk.Tk()
    app = CPUSchedulerApp(root)
    root.mainloop()