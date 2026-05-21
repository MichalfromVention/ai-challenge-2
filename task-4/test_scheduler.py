"""Quick smoke test for the scheduler - validates all 3 task scenarios."""
from config import load_config
from models import Flight, OperationType, Priority
from scheduler import compute_schedule


def print_flights(label: str, flights: list[Flight]) -> None:
    print(f"\n=== {label} ===")
    for f in flights:
        if f.status.value == "scheduled":
            print(f"  {f.flight_number} [{f.priority.value} {f.operation.value}] "
                  f"start={f.scheduled_start_minute} end={f.scheduled_end_minute} "
                  f"runway={f.assigned_runway_id} gate={f.assigned_gate_id}")
        else:
            print(f"  {f.flight_number} [{f.status.value}] "
                  f"reason={f.block_reason!r}")


config = load_config()

# Scenario 1: Morning Rush
flights_1 = [
    Flight("AA001", OperationType.ARRIVAL, Priority.HIGH),
    Flight("BB002", OperationType.DEPARTURE, Priority.MEDIUM),
    Flight("CC003", OperationType.ARRIVAL, Priority.LOW),
    Flight("DD004", OperationType.DEPARTURE, Priority.LOW),
]
compute_schedule(flights_1, config)
print_flights("Scenario 1: Morning Rush", flights_1)

# Scenario 2: Heavy Hauler
flights_2 = [
    Flight("HH999", OperationType.DEPARTURE, Priority.HIGH,
           min_runway_length_meters=5000),
]
compute_schedule(flights_2, config)
print_flights("Scenario 2: Heavy Hauler (oversized)", flights_2)

# Scenario 3: Connecting Flight
flights_3 = [
    Flight("IN100", OperationType.ARRIVAL, Priority.MEDIUM),
    Flight("OUT200", OperationType.DEPARTURE, Priority.MEDIUM,
           dependencies=["IN100"]),
]
compute_schedule(flights_3, config)
print_flights("Scenario 3: Connecting Flight (dependency)", flights_3)