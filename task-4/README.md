# Task 4: MCP – Air Traffic Control Server

A Python MCP server that simulates an Air Traffic Control system: accepts flight submissions, computes deterministic schedules across runways and gates, and exposes operations as MCP tools and resources.

## Prerequisites

- Python 3.10+ (developed against 3.12)
- Node.js 18+ (required by MCP Inspector for `mcp dev`)
- Optional: Claude Desktop for end-user MCP integration

## Installation

```bash
cd task-4
python -m venv venv

# Windows (PowerShell)
Set-ExecutionPolicy -Scope Process Bypass -Force
.\venv\Scripts\Activate.ps1

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Copy the env template:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

## Configuration

All configuration is via environment variables, loaded from `.env`. Defaults from `.env.example` are sensible for a small regional airport.

| Variable | Description | Example |
|---|---|---|
| `ATC_RUNWAY_COUNT` | Number of runways | `3` |
| `ATC_RUNWAY_LENGTHS_METERS` | Comma-separated runway lengths in meters | `3500,3000,2500` |
| `ATC_GATE_COUNT` | Number of gates | `10` |
| `ATC_GROUND_CREW_COUNT` | Ground crew teams available | `5` |
| `ATC_RUNWAY_OPERATION_DURATION_MINUTES` | Takeoff/landing duration | `5` |
| `ATC_BUFFER_TAKEOFF_MINUTES` | Gap between consecutive takeoffs on a runway | `2` |
| `ATC_BUFFER_LANDING_MINUTES` | Gap between consecutive landings on a runway | `2` |
| `ATC_BUFFER_MIXED_MINUTES` | Gap between takeoff and landing on same runway | `3` |
| `ATC_GATE_TURNAROUND_MINUTES` | Minimum gate occupation gap between flights | `30` |
| `ATC_DEPENDENCY_BUFFER_MINUTES` | Required gap between a flight and its dependency | `10` |
| `ATC_MAX_SCHEDULE_HORIZON_HOURS` | Maximum scheduling window from minute 0 | `24` |

Invalid configuration (missing key, non-numeric value, or mismatch between `ATC_RUNWAY_COUNT` and the length of `ATC_RUNWAY_LENGTHS_METERS`) causes the server to fail at startup with a clear error message.

## Running

### MCP Inspector (development)

```bash
mcp dev server.py
```

This launches the MCP Inspector in your browser. In the connection panel set:
- **Command**: `python`
- **Arguments**: `server.py`

then click **Connect**.

### Claude Desktop (end-user)

Add to `claude_desktop_config.json` (Claude → Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "atc": {
      "command": "python",
      "args": ["C:\\path\\to\\task-4\\server.py"],
      "env": {}
    }
  }
}
```

Restart Claude Desktop. The ATC server appears in the available tools.

## Tools

| Tool | Description |
|---|---|
| `submit_flight` | Add a flight to the queue. Accepts flight number, operation (`arrival`/`departure`), priority (`high`/`medium`/`low`), optional `dependencies` list, optional `min_runway_length_meters`. |
| `generate_schedule` | Recompute the schedule from scratch for all non-cancelled flights. Deterministic. |
| `get_airport_status` | Return counts, runway/gate usage, constraint indicators, blocked flight reasons, and schedule completion minute. |
| `cancel_flight` | Mark a flight as cancelled. Cancelled flights are preserved in queue but excluded from scheduling. |
| `analyze_bottleneck` | Return the longest chain of dependent flights with each flight's details and total elapsed time. |

## Resources

| URI | Content |
|---|---|
| `atc://flight-queue` | All flights categorized by status (scheduled, unscheduled, cancelled). |
| `atc://runways` | Runways with lengths and operations assigned to each. |
| `atc://timeline` | Chronological list of all scheduled operations. |

## Project structure

task-4/
├── server.py            # MCP facade (FastMCP, 5 tools, 3 resources)
├── airport.py           # Airport class — thread-safe state
├── scheduler.py         # Pure scheduler — compute_schedule, find_longest_dependency_chain
├── models.py            # Dataclasses and enums
├── config.py            # AirportConfig + load_config from env
├── test_scheduler.py    # Standalone validation of task scenarios
├── .env.example         # Documented config template
├── .env                 # Local config (gitignored)
├── .gitignore
├── requirements.txt
├── README.md
└── report.md

## Testing

Run scheduler-level validation without the MCP layer:

```bash
python test_scheduler.py
```

This runs the three task scenarios (Morning Rush, Heavy Hauler, Connecting Flight) and prints the resulting schedules.

For end-to-end MCP testing, use the Inspector (see Running section) and exercise tools manually.

## Notes

- **List-type arguments in MCP Inspector**: for parameters like `dependencies`, uncheck the "null" checkbox and use the "Add Item" button. Typing into other fields without unchecking null sends `null` to the server.
- **State is in-memory only**: server restart wipes the flight queue. This is by design (per-session ATC).
- **Generate replaces, doesn't append**: `generate_schedule` recomputes from scratch each time, not incrementally.