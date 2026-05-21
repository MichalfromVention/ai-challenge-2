# Task 4: MCP – Air Traffic Control Server

## What this is

A Python MCP server that simulates Air Traffic Control: receives flight submissions, computes a deterministic schedule across runways and gates, and exposes the state through MCP tools and resources. The server runs locally over STDIO and is usable from MCP Inspector or Claude Desktop.

## Architecture

Five files, each with a single responsibility:

| File | Role |
|------|------|
| `config.py` | Loads and validates all `ATC_*` env vars at startup. `AirportConfig` is a frozen dataclass. Invalid configuration raises `ConfigError` and the server fails to boot. |
| `models.py` | Domain types: `OperationType`, `Priority`, `FlightStatus` enums and `Flight`, `Runway`, `Gate` dataclasses. |
| `scheduler.py` | Pure functions: `compute_schedule(flights, config)` and `find_longest_dependency_chain(flights)`. No I/O, no globals. |
| `airport.py` | The `Airport` class – stateful singleton with a `threading.Lock`. Wraps the scheduler and serializes results into plain dicts. |
| `server.py` | MCP facade using `FastMCP`. Five tools and three resources, every one a thin delegation to the singleton. |

The boundary keeps the MCP layer trivial. All scheduling logic lives in `scheduler.py` and `airport.py` and is testable without spinning up the server – `test_scheduler.py` validates the three task scenarios against the pure scheduler.

## Scheduling algorithm

The scheduler is deterministic: for the same flight queue it produces the same schedule regardless of submission order.

1. **Reset.** All non-cancelled flights go back to `pending`. Cancelled flights are untouched.
2. **Topological sort.** Flights are ordered so that every dependency comes before its dependent. Ties (no dependency relation) are broken by `(priority, flight_number)` – high priority first, then alphabetical. Cycles are detected and flagged as `"circular dependency"`.
3. **Greedy slot search.** For each flight in topological order:
   - Compute `earliest_start` from dependency end-times plus `ATC_DEPENDENCY_BUFFER_MINUTES`.
   - Filter runways by `min_runway_length_meters`. If none qualify, block with `"no suitable runway available (requires >= Xm)"`.
   - For each capable runway × each gate, compute the earliest free slot, accounting for the takeoff/landing/mixed separation buffer on the runway and the turnaround time at the gate.
   - Pick the `(runway, gate, start)` tuple with the lowest start minute. Deterministic tiebreak: lower runway id, then lower gate id.
4. **Horizon check.** If the chosen end-time exceeds `ATC_MAX_SCHEDULE_HORIZON_HOURS × 60`, block with `"would exceed schedule horizon (Xh)"`.
5. **Unresolved dependencies.** Flights whose dependency is cancelled or blocked are themselves blocked with the corresponding reason.

`generate_schedule` re-runs the entire algorithm – it replaces the previous schedule rather than incrementally extending it.

## Key design decisions

**Frozen, validated config at startup.** Bad env vars don't surface as cryptic exceptions on first request. `load_config()` raises `ConfigError` with a precise message ("Env var `ATC_RUNWAY_COUNT` must be an integer, got 'three'") and the server fails to boot. Cross-validation catches the trap of `ATC_RUNWAY_LENGTHS_METERS` count not matching `ATC_RUNWAY_COUNT`.

**Block reasons are explicit human-readable strings.** Every blocked flight carries a reason like `"no suitable runway available (requires >= 5000m)"` or `"depends on cancelled flight INBOUND"`. The MCP client (Claude Desktop, Inspector) shows these directly, so the API is self-explanatory – no error-code mapping needed.

**Single source of truth.** The `Airport` singleton owns the flight queue and is protected by a single `threading.Lock`. Tools and resources both read through it. No separate cache or projection.

**Generate replaces, doesn't append.** Running `generate_schedule` twice in a row produces identical output. Cancel semantics stay simple – `cancel_flight` flips the status, the next `generate_schedule` naturally re-blocks the dependents.

**Bottleneck measured by elapsed minutes, not chain count.** `analyze_bottleneck` returns the dependency chain whose total elapsed time (last-end minus first-start) is largest. A long chain of fast flights is less interesting than a short chain of slow ones; the elapsed-time metric reflects the actual critical path through the schedule.

## Validation

`test_scheduler.py` runs the three task-spec scenarios against the pure scheduler (no MCP layer):

- **Morning Rush** – four flights with mixed priorities scheduled correctly with no priority inversion.
- **Heavy Hauler** – an oversized flight (`min_runway_length_meters=5000`, longest runway 3500m) blocked with the runway-length reason; other flights unaffected.
- **Connecting Flight** – a dependent flight starts at `dep.end + ATC_DEPENDENCY_BUFFER_MINUTES` exactly.

End-to-end via MCP Inspector (through the MCP transport):

| Scenario | Outcome |
|----------|---------|
| Morning Rush | Four flights submitted in jumbled order produced a deterministic schedule with high-priority first; takeoff buffer respected between consecutive departures. |
| Heavy Hauler | Oversized flight blocked with the expected reason; rest of the queue unaffected. |
| Connecting Flight | `OUTBOUND2` scheduled at minute 15 after `INBOUND` ending at minute 5 – the 10-minute dependency buffer respected. `schedule_completion_minute: 20`. |
| Cancel cascade | After cancelling `INBOUND`, regenerating the schedule blocked `OUTBOUND2` with `"depends on cancelled flight INBOUND"`. |
| Bottleneck | `analyze_bottleneck` returned the full `INBOUND → OUTBOUND2` chain with `chain_length: 2` and `total_elapsed_minutes: 20`. |

All five tools (`submit_flight`, `generate_schedule`, `get_airport_status`, `cancel_flight`, `analyze_bottleneck`) and three resources (`atc://flight-queue`, `atc://runways`, `atc://timeline`) are reachable and return well-formed JSON.

## Tooling and workflow

Built in Claude Desktop with Claude (Opus 4.7) as the AI partner, with Cursor as the editor – file editing, terminal for `mcp dev server.py`, and `.env` management.

Nothing was committed unread. Where the logic was non-obvious (the runway buffer depending on the operation pair, the two-key tiebreaker in the topological sort), I had Claude explain it back in plain prose and traced examples by hand before accepting it.

## What was tricky

**MCP Inspector's list-parameter input.** The `dependencies` field in `submit_flight` defaults to a checkbox marked "null". Without unchecking it and clicking "Add Item", whatever you type elsewhere doesn't matter – the parameter goes to the server as `None`. Cost me fifteen minutes hunting an imaginary scheduler bug before noticing the checkbox. `analyze_bottleneck` returning `chain_length: 0` was the diagnostic that cracked it: the dependency wasn't in the system at all.

**Inspector resource caching.** Clicking between the three resources in the left panel shows stale content – only the per-resource Refresh button reads fresh. For state inspection during testing I fell back on `get_airport_status`, which is always reliable.

**Distinguishing a UI bug from a logic bug.** When Connecting Flight first showed `OUTBOUND` scheduled in parallel with `INBOUND` instead of after it, both "real scheduler bug" and "Inspector input issue" were plausible. Running `analyze_bottleneck` resolved the ambiguity – an empty chain meant the dependency hadn't reached the server, not that the scheduler was ignoring it. Cheap discriminator first, before reaching for the debugger.

**Server-restart wipes state.** Every Inspector reconnect spawns a fresh process and the flight queue starts empty. By design (no persistence) but worth knowing during testing.

## How to run

See `README.md` for prerequisites, environment setup, and running the server via MCP Inspector or Claude Desktop.