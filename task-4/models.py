"""Data models for the ATC system: flights and resources."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class OperationType(str, Enum):
    ARRIVAL = "arrival"
    DEPARTURE = "departure"


class Priority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# Sort key for priorities: lower number = scheduled earlier when resources contested.
PRIORITY_ORDER = {
    Priority.HIGH: 0,
    Priority.MEDIUM: 1,
    Priority.LOW: 2,
}


class FlightStatus(str, Enum):
    PENDING = "pending"        # submitted, waiting to be scheduled
    SCHEDULED = "scheduled"    # has a timeline slot
    BLOCKED = "blocked"        # cannot be scheduled (reason in block_reason)
    CANCELLED = "cancelled"    # cancelled by user


@dataclass
class Flight:
    """A flight in the system - mutates as scheduling progresses."""
    flight_number: str
    operation: OperationType
    priority: Priority
    dependencies: list[str] = field(default_factory=list)
    min_runway_length_meters: Optional[int] = None

    # Status
    status: FlightStatus = FlightStatus.PENDING
    block_reason: Optional[str] = None

    # Scheduling result (None if not scheduled)
    scheduled_start_minute: Optional[int] = None
    scheduled_end_minute: Optional[int] = None
    assigned_runway_id: Optional[int] = None
    assigned_gate_id: Optional[int] = None


@dataclass(frozen=True)
class Runway:
    """A runway with a length capability."""
    id: int
    length_meters: int


@dataclass(frozen=True)
class Gate:
    """A gate."""
    id: int