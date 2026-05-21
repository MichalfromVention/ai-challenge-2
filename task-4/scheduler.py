"""Greedy priority-aware scheduler with dependency handling.

Algorithm:
1. Topological sort of flights by dependencies, breaking ties by (priority, flight_number).
   This ensures dependencies are scheduled before dependents AND that high-priority
   flights win when no dependency forces order.
2. For each flight in that order, greedily find the earliest valid slot:
   - Filter runways by required min length (block if none capable).
   - For each capable runway × gate combination, find earliest free slot considering
     separation buffers (runway) and turnaround time (gate).
   - Pick the combination with the earliest start time. Deterministic tiebreak: lower
     runway id, then lower gate id.
3. Respect dependency buffer between dependent flights.
4. Block flights that exceed the scheduling horizon or whose dependencies are blocked.

Determinism: all sorts use stable ordering with flight_number as final tiebreaker, and
resources are iterated by id ascending.
"""
from dataclasses import dataclass
from typing import Optional

from config import AirportConfig
from models import (
    Flight,
    FlightStatus,
    OperationType,
    PRIORITY_ORDER,
    Runway,
)


# --------------------------------------------------------------------------- #
# Internal booking records (per-resource)                                     #
# --------------------------------------------------------------------------- #

@dataclass
class _RunwayBooking:
    flight_number: str
    operation: OperationType
    start_minute: int
    end_minute: int


@dataclass
class _GateBooking:
    flight_number: str
    start_minute: int
    end_minute: int


# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #

def _runway_buffer(prev_op: OperationType, next_op: OperationType,
                   config: AirportConfig) -> int:
    """Required separation between two consecutive runway operations."""
    if prev_op == OperationType.DEPARTURE and next_op == OperationType.DEPARTURE:
        return config.buffer_takeoff_minutes
    if prev_op == OperationType.ARRIVAL and next_op == OperationType.ARRIVAL:
        return config.buffer_landing_minutes
    return config.buffer_mixed_minutes


def _earliest_runway_slot(
    bookings: list[_RunwayBooking],
    earliest_start: int,
    duration: int,
    op_type: OperationType,
    config: AirportConfig,
) -> int:
    """Earliest minute >= earliest_start at which `duration` minutes are free on a runway."""
    sorted_bookings = sorted(bookings, key=lambda b: b.start_minute)
    candidate = earliest_start

    for b in sorted_bookings:
        buf = _runway_buffer(b.operation, op_type, config)
        # If this booking ended long enough ago, it doesn't affect us.
        if b.end_minute + buf <= candidate:
            continue
        # Can we fit before this booking starts?
        if candidate + duration + buf <= b.start_minute:
            return candidate
        # Otherwise, push past this booking.
        candidate = b.end_minute + buf
    return candidate


def _earliest_gate_slot(
    bookings: list[_GateBooking],
    earliest_start: int,
    duration: int,
    config: AirportConfig,
) -> int:
    """Earliest minute >= earliest_start at which `duration` minutes are free at a gate."""
    sorted_bookings = sorted(bookings, key=lambda b: b.start_minute)
    candidate = earliest_start
    turnaround = config.gate_turnaround_minutes

    for b in sorted_bookings:
        if b.end_minute + turnaround <= candidate:
            continue
        if candidate + duration + turnaround <= b.start_minute:
            return candidate
        candidate = b.end_minute + turnaround
    return candidate


def _topological_sort(flights: list[Flight]) -> tuple[list[Flight], list[Flight]]:
    """Topological sort by dependencies; ties broken by (priority, flight_number).

    Returns (ordered, cycle_flights). Cycle flights couldn't be ordered.
    Only considers flights present in the input list - external deps are ignored.
    """
    by_num = {f.flight_number: f for f in flights}
    indegree = {f.flight_number: 0 for f in flights}
    dependents: dict[str, list[str]] = {f.flight_number: [] for f in flights}

    for f in flights:
        for dep in f.dependencies:
            if dep in by_num:
                dependents[dep].append(f.flight_number)
                indegree[f.flight_number] += 1

    def sort_key(fl: Flight) -> tuple[int, str]:
        return (PRIORITY_ORDER[fl.priority], fl.flight_number)

    available = sorted(
        [f for f in flights if indegree[f.flight_number] == 0],
        key=sort_key,
    )
    ordered: list[Flight] = []

    while available:
        flight = available.pop(0)
        ordered.append(flight)
        for dependent_num in sorted(dependents[flight.flight_number]):
            indegree[dependent_num] -= 1
            if indegree[dependent_num] == 0:
                next_flight = by_num[dependent_num]
                # Insertion sort to keep `available` sorted by sort_key.
                inserted = False
                for i, existing in enumerate(available):
                    if sort_key(next_flight) < sort_key(existing):
                        available.insert(i, next_flight)
                        inserted = True
                        break
                if not inserted:
                    available.append(next_flight)

    ordered_set = {f.flight_number for f in ordered}
    cycle = [f for f in flights if f.flight_number not in ordered_set]
    return ordered, cycle


# --------------------------------------------------------------------------- #
# Main scheduling entry point                                                 #
# --------------------------------------------------------------------------- #

def compute_schedule(flights: list[Flight], config: AirportConfig) -> list[Flight]:
    """Compute a deterministic schedule for the given flights.

    Mutates flights in place (sets status, scheduled_* and assigned_* fields).
    Cancelled flights are left untouched. Returns the same list.
    """
    runways = [Runway(id=i, length_meters=length)
               for i, length in enumerate(config.runway_lengths_meters)]
    duration = config.runway_operation_duration_minutes
    horizon_min = config.max_schedule_horizon_hours * 60

    # Reset all non-cancelled flights to a clean state.
    for f in flights:
        if f.status == FlightStatus.CANCELLED:
            continue
        f.status = FlightStatus.PENDING
        f.block_reason = None
        f.scheduled_start_minute = None
        f.scheduled_end_minute = None
        f.assigned_runway_id = None
        f.assigned_gate_id = None

    active = [f for f in flights if f.status != FlightStatus.CANCELLED]
    ordered, cycle_flights = _topological_sort(active)
    for f in cycle_flights:
        f.status = FlightStatus.BLOCKED
        f.block_reason = "circular dependency"

    by_num = {f.flight_number: f for f in flights}
    runway_bookings: dict[int, list[_RunwayBooking]] = {r.id: [] for r in runways}
    gate_bookings: dict[int, list[_GateBooking]] = {i: [] for i in range(config.gate_count)}

    for flight in ordered:
        # Compute earliest start based on dependencies.
        earliest_start = 0
        dep_blocked = False
        for dep_num in flight.dependencies:
            dep_flight = by_num.get(dep_num)
            if dep_flight is None:
                continue  # external dep
            if dep_flight.status == FlightStatus.CANCELLED:
                flight.status = FlightStatus.BLOCKED
                flight.block_reason = f"depends on cancelled flight {dep_num}"
                dep_blocked = True
                break
            if dep_flight.status == FlightStatus.BLOCKED:
                flight.status = FlightStatus.BLOCKED
                flight.block_reason = f"depends on blocked flight {dep_num}"
                dep_blocked = True
                break
            if dep_flight.status != FlightStatus.SCHEDULED:
                flight.status = FlightStatus.BLOCKED
                flight.block_reason = f"dependency {dep_num} unresolved"
                dep_blocked = True
                break
            earliest_start = max(
                earliest_start,
                (dep_flight.scheduled_end_minute or 0) + config.dependency_buffer_minutes,
            )
        if dep_blocked:
            continue

        # Filter runways by length requirement.
        if flight.min_runway_length_meters is not None:
            capable = [r for r in runways
                       if r.length_meters >= flight.min_runway_length_meters]
        else:
            capable = list(runways)

        if not capable:
            flight.status = FlightStatus.BLOCKED
            flight.block_reason = (
                f"no suitable runway available "
                f"(requires >= {flight.min_runway_length_meters}m)"
            )
            continue

        # Find best (start, runway_id, gate_id) tuple - earliest start wins.
        best: Optional[tuple[int, int, int]] = None
        for runway in sorted(capable, key=lambda r: r.id):
            r_start = _earliest_runway_slot(
                runway_bookings[runway.id], earliest_start, duration,
                flight.operation, config,
            )
            for gate_id in range(config.gate_count):
                g_start = _earliest_gate_slot(
                    gate_bookings[gate_id], r_start, duration, config,
                )
                # If gate forces later start, runway slot may also shift.
                if g_start > r_start:
                    r_recheck = _earliest_runway_slot(
                        runway_bookings[runway.id], g_start, duration,
                        flight.operation, config,
                    )
                    actual_start = max(g_start, r_recheck)
                else:
                    actual_start = r_start

                if best is None or actual_start < best[0]:
                    best = (actual_start, runway.id, gate_id)
                if best[0] == earliest_start:
                    break
            if best is not None and best[0] == earliest_start:
                break

        if best is None:
            flight.status = FlightStatus.BLOCKED
            flight.block_reason = "no available resource slot"
            continue

        start, runway_id, gate_id = best
        end = start + duration

        if end > horizon_min:
            flight.status = FlightStatus.BLOCKED
            flight.block_reason = (
                f"would exceed schedule horizon ({config.max_schedule_horizon_hours}h)"
            )
            continue

        # Commit the booking.
        flight.status = FlightStatus.SCHEDULED
        flight.scheduled_start_minute = start
        flight.scheduled_end_minute = end
        flight.assigned_runway_id = runway_id
        flight.assigned_gate_id = gate_id
        runway_bookings[runway_id].append(
            _RunwayBooking(flight.flight_number, flight.operation, start, end)
        )
        gate_bookings[gate_id].append(
            _GateBooking(flight.flight_number, start, end)
        )

    return flights


# --------------------------------------------------------------------------- #
# Bottleneck analysis                                                         #
# --------------------------------------------------------------------------- #

def find_longest_dependency_chain(
    flights: list[Flight],
) -> tuple[list[Flight], int]:
    """Find the longest active scheduled dependency chain.

    The chain is "longest" by total elapsed duration in the actual schedule
    (last flight's end minute minus first flight's start minute), not by count.
    A chain must have at least two flights to be returned.

    Returns:
        (ordered_chain, total_elapsed_minutes). Empty list & 0 if no chain exists.
    """
    scheduled = {
        f.flight_number: f
        for f in flights
        if f.status == FlightStatus.SCHEDULED
    }
    if len(scheduled) < 2:
        return [], 0

    # best_chain_ending_at[flight_number] = longest-duration chain ending there
    best_chain_ending_at: dict[str, list[Flight]] = {}

    # Process in (start_minute, flight_number) order - deps come first since they
    # start earlier (compute_schedule enforces this).
    ordered = sorted(
        scheduled.values(),
        key=lambda f: (f.scheduled_start_minute or 0, f.flight_number),
    )

    for f in ordered:
        scheduled_deps = [d for d in f.dependencies if d in scheduled]
        if not scheduled_deps:
            best_chain_ending_at[f.flight_number] = [f]
            continue

        best_extended_chain: list[Flight] = []
        best_extended_duration = -1
        for dep_num in scheduled_deps:
            candidate = best_chain_ending_at[dep_num] + [f]
            duration = (
                (candidate[-1].scheduled_end_minute or 0)
                - (candidate[0].scheduled_start_minute or 0)
            )
            if duration > best_extended_duration:
                best_extended_duration = duration
                best_extended_chain = candidate
        best_chain_ending_at[f.flight_number] = best_extended_chain

    # Find the overall longest (by duration) chain of length >= 2.
    longest: list[Flight] = []
    longest_duration = 0
    for chain in best_chain_ending_at.values():
        if len(chain) < 2:
            continue
        duration = (
            (chain[-1].scheduled_end_minute or 0)
            - (chain[0].scheduled_start_minute or 0)
        )
        if duration > longest_duration:
            longest_duration = duration
            longest = chain

    return longest, longest_duration