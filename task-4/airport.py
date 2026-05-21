"""In-memory airport state with thread-safe operations.

Holds the canonical flight list and exposes the operations used by the MCP tools
and resources. Returns plain dicts so results serialize cleanly across MCP.
"""
from threading import Lock
from typing import Optional

from config import AirportConfig
from models import Flight, FlightStatus, OperationType, Priority
from scheduler import compute_schedule, find_longest_dependency_chain


class Airport:
    """In-memory state for a single airport instance."""

    def __init__(self, config: AirportConfig):
        self.config = config
        self.flights: list[Flight] = []
        self._lock = Lock()

    # --------------------------------------------------------------------- #
    # Mutations                                                             #
    # --------------------------------------------------------------------- #

    def submit_flight(
        self,
        flight_number: str,
        operation: str,
        priority: str,
        dependencies: Optional[list[str]] = None,
        min_runway_length_meters: Optional[int] = None,
    ) -> dict:
        """Submit a new flight. Raises ValueError on invalid input or duplicate."""
        with self._lock:
            if any(f.flight_number == flight_number for f in self.flights):
                raise ValueError(f"Flight {flight_number} already exists.")
            try:
                op = OperationType(operation)
            except ValueError:
                raise ValueError(
                    f"Invalid operation {operation!r}. Must be 'arrival' or 'departure'."
                )
            try:
                pri = Priority(priority)
            except ValueError:
                raise ValueError(
                    f"Invalid priority {priority!r}. Must be 'high', 'medium', or 'low'."
                )
            if min_runway_length_meters is not None and min_runway_length_meters < 0:
                raise ValueError("min_runway_length_meters must be non-negative.")

            flight = Flight(
                flight_number=flight_number,
                operation=op,
                priority=pri,
                dependencies=list(dependencies or []),
                min_runway_length_meters=min_runway_length_meters,
            )
            self.flights.append(flight)
            return self._flight_to_dict(flight)

    def cancel_flight(self, flight_number: str) -> dict:
        """Mark a flight as cancelled and clear its scheduling result."""
        with self._lock:
            for f in self.flights:
                if f.flight_number == flight_number:
                    f.status = FlightStatus.CANCELLED
                    f.block_reason = None
                    f.scheduled_start_minute = None
                    f.scheduled_end_minute = None
                    f.assigned_runway_id = None
                    f.assigned_gate_id = None
                    # Dependents will be re-evaluated on next generate_schedule().
                    return {"flight_number": flight_number, "cancelled": True}
            raise ValueError(f"Flight {flight_number} not found.")

    def generate_schedule(self) -> dict:
        """Recompute the schedule based on the current flight queue."""
        with self._lock:
            compute_schedule(self.flights, self.config)
        return self.get_status()

    # --------------------------------------------------------------------- #
    # Reads                                                                 #
    # --------------------------------------------------------------------- #

    def get_status(self) -> dict:
        with self._lock:
            counts_by_status: dict[str, int] = {}
            counts_by_operation: dict[str, int] = {}
            for f in self.flights:
                counts_by_status[f.status.value] = counts_by_status.get(f.status.value, 0) + 1
                if f.status != FlightStatus.CANCELLED:
                    counts_by_operation[f.operation.value] = (
                        counts_by_operation.get(f.operation.value, 0) + 1
                    )

            runway_usage = {i: 0 for i in range(self.config.runway_count)}
            gate_usage = {i: 0 for i in range(self.config.gate_count)}
            for f in self.flights:
                if f.status == FlightStatus.SCHEDULED:
                    if f.assigned_runway_id is not None:
                        runway_usage[f.assigned_runway_id] += 1
                    if f.assigned_gate_id is not None:
                        gate_usage[f.assigned_gate_id] += 1

            scheduled = [f for f in self.flights if f.status == FlightStatus.SCHEDULED]
            schedule_completion_minute = max(
                (f.scheduled_end_minute or 0 for f in scheduled),
                default=None,
            )

            unscheduled = [
                {"flight_number": f.flight_number, "reason": f.block_reason}
                for f in self.flights
                if f.status == FlightStatus.BLOCKED
            ]

            all_runways_in_use = bool(runway_usage) and all(v > 0 for v in runway_usage.values())
            all_gates_in_use = bool(gate_usage) and all(v > 0 for v in gate_usage.values())

            return {
                "flight_counts_by_status": counts_by_status,
                "flight_counts_by_operation": counts_by_operation,
                "resources": {
                    "runways": {
                        "total": self.config.runway_count,
                        "lengths_meters": list(self.config.runway_lengths_meters),
                        "usage_by_id": runway_usage,
                    },
                    "gates": {
                        "total": self.config.gate_count,
                        "usage_by_id": gate_usage,
                    },
                    "ground_crew_total": self.config.ground_crew_count,
                },
                "constraint_indicators": {
                    "all_runways_in_use": all_runways_in_use,
                    "all_gates_in_use": all_gates_in_use,
                },
                "blocked_flights": unscheduled,
                "schedule_completion_minute": schedule_completion_minute,
            }

    def get_flight_queue(self) -> dict:
        with self._lock:
            return {
                "scheduled": [
                    self._flight_to_dict(f) for f in self._sorted(self.flights)
                    if f.status == FlightStatus.SCHEDULED
                ],
                "unscheduled": [
                    self._flight_to_dict(f) for f in self._sorted(self.flights)
                    if f.status in (FlightStatus.PENDING, FlightStatus.BLOCKED)
                ],
                "cancelled": [
                    self._flight_to_dict(f) for f in self._sorted(self.flights)
                    if f.status == FlightStatus.CANCELLED
                ],
            }

    def get_runway_info(self) -> dict:
        with self._lock:
            runways = []
            for i, length in enumerate(self.config.runway_lengths_meters):
                ops = sorted(
                    [
                        f for f in self.flights
                        if f.status == FlightStatus.SCHEDULED
                        and f.assigned_runway_id == i
                    ],
                    key=lambda f: (f.scheduled_start_minute or 0, f.flight_number),
                )
                runways.append({
                    "id": i,
                    "length_meters": length,
                    "scheduled_operations": [
                        {
                            "flight_number": f.flight_number,
                            "operation": f.operation.value,
                            "start_minute": f.scheduled_start_minute,
                            "end_minute": f.scheduled_end_minute,
                        }
                        for f in ops
                    ],
                })
            return {"runways": runways}

    def get_timeline(self) -> list[dict]:
        with self._lock:
            scheduled = [f for f in self.flights if f.status == FlightStatus.SCHEDULED]
            scheduled.sort(key=lambda f: (f.scheduled_start_minute or 0, f.flight_number))
            return [self._flight_to_dict(f) for f in scheduled]

    def get_bottleneck(self) -> dict:
        with self._lock:
            chain, duration = find_longest_dependency_chain(self.flights)
            return {
                "chain": [self._flight_to_dict(f) for f in chain],
                "chain_length": len(chain),
                "total_elapsed_minutes": duration,
            }

    # --------------------------------------------------------------------- #
    # Helpers                                                               #
    # --------------------------------------------------------------------- #

    @staticmethod
    def _sorted(flights: list[Flight]) -> list[Flight]:
        return sorted(flights, key=lambda f: f.flight_number)

    @staticmethod
    def _flight_to_dict(flight: Flight) -> dict:
        return {
            "flight_number": flight.flight_number,
            "operation": flight.operation.value,
            "priority": flight.priority.value,
            "dependencies": list(flight.dependencies),
            "min_runway_length_meters": flight.min_runway_length_meters,
            "status": flight.status.value,
            "block_reason": flight.block_reason,
            "scheduled_start_minute": flight.scheduled_start_minute,
            "scheduled_end_minute": flight.scheduled_end_minute,
            "assigned_runway_id": flight.assigned_runway_id,
            "assigned_gate_id": flight.assigned_gate_id,
        }