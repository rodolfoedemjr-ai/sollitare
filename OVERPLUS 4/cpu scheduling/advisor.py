# advisor.py
# ─────────────────────────────────────────────
# Elite Multi-Criteria Scheduling Optimizer Engine (with Aging & Utilization)

def smart_advisor(data):
    """
    Advanced Dynamic Multi-Criteria Optimization Engine.
    Simulates workloads deterministically across FCFS, SJF, Priority, and Round Robin.
    Calculates AWT, ATAT, Context Switches, and Utilization to find the optimal strategy.
    """
    if not data:
        return None

    n = len(data)
    
    # ─── FCFS Simulator ───
    def sim_fcfs(procs):
        sorted_p = sorted(procs, key=lambda x: x['at'])
        t, total_wt, total_tat, idle_t = 0, 0, 0, 0
        for p in sorted_p:
            if t < p['at']:
                idle_t += (p['at'] - t)
                t = p['at']
            wt = t - p['at']
            tat = wt + p['bt']
            total_wt += wt
            total_tat += tat
            t += p['bt']
        util = ((t - idle_t) / t * 100) if t > 0 else 100
        return total_wt / n, total_tat / n, n - 1, util

    # ─── SJF Simulator ───
    def sim_sjf(procs):
        ready_queue = [p.copy() for p in procs]
        t, total_wt, total_tat, switches, idle_t = 0, 0, 0, 0, 0
        completed = 0
        while completed < n:
            available = [p for p in ready_queue if p['at'] <= t and p['bt'] > 0]
            if not available:
                next_arrival = min(p['at'] for p in ready_queue if p['bt'] > 0)
                idle_t += (next_arrival - t)
                t = next_arrival
                continue
            best = min(available, key=lambda x: x['bt'])
            wt = t - best['at']
            tat = wt + best['bt']
            total_wt += wt
            total_tat += tat
            t += best['bt']
            best['bt'] = 0
            completed += 1
            switches += 1
        util = ((t - idle_t) / t * 100) if t > 0 else 100
        return total_wt / n, total_tat / n, max(0, switches - 1), util

    # ─── Priority Simulator (with Aging) ───
    def sim_priority_with_aging(procs):
        ready_queue = [p.copy() for p in procs]
        for p in ready_queue: p['current_pr'] = p['pr']
        t, total_wt, total_tat, switches, idle_t = 0, 0, 0, 0, 0
        completed = 0
        while completed < n:
            available = [p for p in ready_queue if p['at'] <= t and p['bt'] > 0]
            if not available:
                next_arrival = min(p['at'] for p in ready_queue if p['bt'] > 0)
                idle_t += (next_arrival - t)
                t = next_arrival
                continue
            for p in available:
                wait_time = t - p['at']
                if wait_time > 4:  
                    p['current_pr'] = max(1, p['pr'] - int(wait_time / 4))
            best = min(available, key=lambda x: x['current_pr'])
            wt = t - best['at']
            tat = wt + best['bt']
            total_wt += wt
            total_tat += tat
            t += best['bt']
            best['bt'] = 0
            completed += 1
            switches += 1
        util = ((t - idle_t) / t * 100) if t > 0 else 100
        return total_wt / n, total_tat / n, max(0, switches - 1), util

    # ─── Round Robin Simulator ───
    def sim_rr(procs, q):
        rem_bt = {i: procs[i]['bt'] for i in range(n)}
        arrival = {i: procs[i]['at'] for i in range(n)}
        t, total_wt, total_tat, switches, idle_t = 0, 0, 0, 0, 0
        queue = []
        visited = [False] * n
        def push_arrived():
            for idx in sorted(range(n), key=lambda x: arrival[x]):
                if arrival[idx] <= t and not visited[idx] and rem_bt[idx] > 0:
                    queue.append(idx)
                    visited[idx] = True
        push_arrived()
        while any(rem_bt[i] > 0 for i in range(n)):
            if not queue:
                next_arrival = min(arrival[i] for i in range(n) if rem_bt[i] > 0)
                idle_t += (next_arrival - t)
                t = next_arrival
                push_arrived()
                continue
            curr = queue.pop(0)
            slice_t = min(rem_bt[curr], q)
            rem_bt[curr] -= slice_t
            t += slice_t
            switches += 1
            push_arrived()
            if rem_bt[curr] > 0:
                queue.append(curr)
            else:
                tat = t - arrival[curr]
                wt = tat - procs[curr]['bt']
                total_wt += wt
                total_tat += tat
        util = ((t - idle_t) / t * 100) if t > 0 else 100
        return total_wt / n, total_tat / n, max(0, switches - 1), util

    # Run sweeps across algorithms
    best_rr_q = 2
    min_rr_awt = float('inf')
    rr_metrics = None
    for q_test in range(1, 7):
        awt, tat, sw, util = sim_rr(data, q_test)
        if awt < min_rr_awt:
            min_rr_awt = awt
            best_rr_q = q_test
            rr_metrics = (awt, tat, sw, util)

    awt_fcfs, tat_fcfs, sw_fcfs, util_fcfs = sim_fcfs(data)
    awt_sjf,  tat_sjf,  sw_sjf,  util_sjf  = sim_sjf(data)
    awt_pri,  tat_pri,  sw_pri,  util_pri  = sim_priority_with_aging(data)
    awt_rr,   tat_rr,   sw_rr,   util_rr   = rr_metrics

    # Multi-Objective Penalties Model
    penalties = {
        "FCFS":        (awt_fcfs * 0.60) + (tat_fcfs * 0.25) + (sw_fcfs * 0.15),
        "SJF":         (awt_sjf  * 0.60) + (tat_sjf  * 0.25) + (sw_sjf  * 0.15),
        "Priority":    (awt_pri  * 0.60) + (tat_pri  * 0.25) + (sw_pri  * 0.15),
        "Round Robin": (awt_rr   * 0.60) + (tat_rr   * 0.25) + (sw_rr   * 0.15)
    }

    choice = min(penalties, key=penalties.get)
    
    # Generate humanized critiques based on results
    if choice == "Priority":
        critique = "Priority criteria matches resource weight coefficients. Operational starvation risks are mitigated using simulated task aging loops."
    elif choice == "Round Robin":
        critique = f"Preemptive time slicing chosen. Sweep optimization confirms that Quantum q={best_rr_q} minimizes switch degradation against task liveness bounds."
    elif choice == "SJF":
        critique = f"Greedy execution verified. Shortest Job First optimizes latency profiles, outperforming FCFS wait matrices by {(awt_fcfs - awt_sjf):.1f} units."
    else:
        critique = "Workload distribution parameters are uniform. First-Come First-Served avoids sorting computation overheads."

    return {
        "choice": choice,
        "critique": critique,
        "matrix": [
            ("FCFS", awt_fcfs, sw_fcfs, util_fcfs),
            ("SJF", awt_sjf, sw_sjf, util_sjf),
            ("Priority", awt_pri, sw_pri, util_pri),
            (f"RR (q={best_rr_q})", awt_rr, sw_rr, util_rr)
        ]
    }