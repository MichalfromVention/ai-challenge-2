"""ATC MCP Server - Air Traffic Control system for AI Challenge 2 Task 4.

Exposes airport scheduling and analysis through MCP tools and resources.
Singleton airport instance is created at startup using configuration from .env.
Invalid configuration causes the server to fail at startup with a clear message.
"""
import json
from typing import Optional

from mcp.server.fastmcp import FastMCP

from airport import Airport
from config import load_config

# Load config and create singleton airport instance.
# load_config() raises ConfigError on invalid input, which fails the server startup.
_config = load_config()
_airport = Airport(_config)

mcp = FastMCP("ATC")


# --------------------------------------------------------------------------- #
# MCP Tools                                                                   #
# --------------------------------------------------------------------------- #

@mcp.tool()
def submit_flight(
    flight_number: str,
    operation: str,
    priority: str,
    dependencies: Optional[list[str]] = None,
    min_runway_length_meters: Optional[int] = None,
) -> dict:
    """Submit a new arrival or departure to the airport.

    The flight starts as 'pending' and will be scheduled (or blocked with a
    reason) the next time generate_schedule is called.

    Args:
        flight_number: Unique identifier (e.g. "AA001"). Must not already exist.
        operation: Either "arrival" or "departure".
        priority: One of "high", "medium", or "low".
        dependencies: Optional list of flight numbers this flight depends on.
            A dependent flight cannot start until each dependency has finished
            plus the configured dependency buffer.
        min_runway_length_meters: Optional minimum runway length required for
            this flight. Flights with no suitable runway will be blocked.

    Returns:
        The created flight record as a dict.
    """
    return _airport.submit_flight(
        flight_number=flight_number,
        operation=operation,
        priority=priority,
        dependencies=dependencies,
        min_runway_length_meters=min_runway_length_meters,
    )


@mcp.tool()
def generate_schedule() -> dict:
    """Recompute the airport schedule from scratch based on the current flight queue.

    Replaces any previously-computed schedule. Each non-cancelled flight is
    either assigned a runway+gate+time slot or marked blocked with a clear reason
    (e.g. "no suitable runway", "depends on cancelled flight", "would exceed
    schedule horizon"). The algorithm is deterministic for identical inputs.

    Returns:
        Airport status summary after scheduling: flight counts, resource usage,
        constraint indicators, blocked flights with reasons, and the schedule
        completion minute when a schedule exists.
    """
    return _airport.generate_schedule()


@mcp.tool()
def get_airport_status() -> dict:
    """Return the current operational status of the airport.

    Includes flight counts by state and operation type, runway and gate
    capacity and usage by id, resource constraint indicators, blocked or
    otherwise unscheduled flights with reasons, and the current schedule
    completion minute when available.
    """
    return _airport.get_status()


@mcp.tool()
def cancel_flight(flight_number: str) -> dict:
    """Cancel a flight and clear its schedule assignment.

    The flight is marked 'cancelled'. Dependent flights are re-evaluated on
    the next generate_schedule call and will be blocked with a clear reason
    if their dependency is no longer schedulable.

    Args:
        flight_number: The flight to cancel.

    Returns:
        Confirmation with the flight number and cancelled=true.
    """
    return _airport.cancel_flight(flight_number)


@mcp.tool()
def analyze_bottleneck() -> dict:
    """Identify the longest active scheduled dependency chain.

    "Longest" is measured by total elapsed minutes in the actual schedule
    (end of the last flight minus start of the first), reflecting the
    critical path that drives the schedule's total duration. Requires a
    schedule to have been generated.

    Returns:
        A dict with the ordered chain of flights, the chain length, and the
        total elapsed duration in minutes. Returns an empty chain if no
        scheduled dependency exists.
    """
    return _airport.get_bottleneck()


# --------------------------------------------------------------------------- #
# MCP Resources                                                               #
# --------------------------------------------------------------------------- #

@mcp.resource("atc://flight-queue")
def flight_queue_resource() -> str:
    """Current flight queue, categorized into scheduled, unscheduled, and cancelled."""
    return json.dumps(_airport.get_flight_queue(), indent=2)


@mcp.resource("atc://runways")
def runways_resource() -> str:
    """Runway list with lengths and scheduled operations per runway."""
    return json.dumps(_airport.get_runway_info(), indent=2)


@mcp.resource("atc://timeline")
def timeline_resource() -> str:
    """Chronological timeline of all scheduled airport operations."""
    return json.dumps({"operations": _airport.get_timeline()}, indent=2)


# --------------------------------------------------------------------------- #
# Entry point                                                                 #
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    mcp.run()