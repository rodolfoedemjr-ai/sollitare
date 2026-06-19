# algorithms.py
# ─────────────────────────────────────────────
# Contains all scheduling algorithms and stats computation.

def fcfs(data):
    d = sorted(data, key=lambda x: x["at"])
    time, chart = 0, []
    for p in d:
        if time < p["at"]:
            time = p["at"]
        chart.append((p["name"], time, time + p["bt"]))
        time += p["bt"]
    return chart


def sjf(data):
    d = sorted(data, key=lambda x: x["at"])
    time, chart, ready = 0, [], []
    while d or ready:
        while d and d[0]["at"] <= time:
            ready.append(d.pop(0))
        if not ready:
            time = d[0]["at"]
            continue
        ready.sort(key=lambda x: x["bt"])
        p = ready.pop(0)
        chart.append((p["name"], time, time + p["bt"]))
        time += p["bt"]
    return chart


def priority_algo(data):
    d = sorted(data, key=lambda x: x["at"])
    time, chart, ready = 0, [], []
    while d or ready:
        while d and d[0]["at"] <= time:
            ready.append(d.pop(0))
        if not ready:
            time = d[0]["at"]
            continue
        ready.sort(key=lambda x: x["pr"])
        p = ready.pop(0)
        chart.append((p["name"], time, time + p["bt"]))
        time += p["bt"]
    return chart


def round_robin(data, quantum):
    queue = sorted(data, key=lambda x: x["at"])
    rem = {p["name"]: p["bt"] for p in data}
    time, chart, ready = 0, [], []
    arrived = 0
    while True:
        while arrived < len(queue) and queue[arrived]["at"] <= time:
            ready.append(dict(queue[arrived]))
            arrived += 1
        if not ready:
            if arrived < len(queue):
                time = queue[arrived]["at"]
                continue
            break
        cur = ready.pop(0)
        exec_t = min(quantum, rem[cur["name"]])
        chart.append((cur["name"], time, time + exec_t))
        time += exec_t
        rem[cur["name"]] -= exec_t
        while arrived < len(queue) and queue[arrived]["at"] <= time:
            ready.append(dict(queue[arrived]))
            arrived += 1
        if rem[cur["name"]] > 0:
            ready.append(cur)
    return chart


def compute_stats(data, chart):
    stats = []
    for p in data:
        segs = [(s, e) for (n, s, e) in chart if n == p["name"]]
        completion = max(e for _, e in segs)
        tat = completion - p["at"]
        wt = tat - p["bt"]
        stats.append({
            "name": p["name"], "at": p["at"], "bt": p["bt"],
            "completion": completion, "tat": tat, "wt": wt
        })
    return stats