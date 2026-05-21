"""Airport configuration loaded from environment variables with validation at startup.

All ATC_* env vars are required. Invalid configuration raises ConfigError immediately.
"""
import os
from dataclasses import dataclass
from typing import List

from dotenv import load_dotenv


class ConfigError(Exception):
    """Raised when configuration is missing or invalid."""


@dataclass(frozen=True)
class AirportConfig:
    """Immutable airport configuration. All values validated at construction time."""
    runway_count: int
    runway_lengths_meters: List[int]
    gate_count: int
    ground_crew_count: int
    runway_operation_duration_minutes: int
    buffer_takeoff_minutes: int
    buffer_landing_minutes: int
    buffer_mixed_minutes: int
    gate_turnaround_minutes: int
    dependency_buffer_minutes: int
    max_schedule_horizon_hours: int


def _get_int(key: str, *, min_value: int = 1) -> int:
    raw = os.environ.get(key)
    if raw is None or raw.strip() == "":
        raise ConfigError(f"Missing required env var: {key}")
    try:
        value = int(raw)
    except ValueError:
        raise ConfigError(f"Env var {key} must be an integer, got {raw!r}")
    if value < min_value:
        raise ConfigError(f"Env var {key} must be >= {min_value}, got {value}")
    return value


def _get_int_list(key: str, *, min_value: int = 1) -> List[int]:
    raw = os.environ.get(key)
    if raw is None or raw.strip() == "":
        raise ConfigError(f"Missing required env var: {key}")
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if not parts:
        raise ConfigError(f"Env var {key} must contain at least one value")
    try:
        values = [int(p) for p in parts]
    except ValueError:
        raise ConfigError(
            f"Env var {key} must be a comma-separated list of integers, got {raw!r}"
        )
    for v in values:
        if v < min_value:
            raise ConfigError(f"Each value in {key} must be >= {min_value}, got {v}")
    return values


def load_config() -> AirportConfig:
    """Load and validate airport configuration. Raises ConfigError on invalid input."""
    load_dotenv()

    runway_count = _get_int("ATC_RUNWAY_COUNT")
    runway_lengths = _get_int_list("ATC_RUNWAY_LENGTHS_METERS")

    if len(runway_lengths) != runway_count:
        raise ConfigError(
            f"ATC_RUNWAY_LENGTHS_METERS must have exactly {runway_count} values "
            f"(matching ATC_RUNWAY_COUNT), got {len(runway_lengths)}"
        )

    return AirportConfig(
        runway_count=runway_count,
        runway_lengths_meters=runway_lengths,
        gate_count=_get_int("ATC_GATE_COUNT"),
        ground_crew_count=_get_int("ATC_GROUND_CREW_COUNT"),
        runway_operation_duration_minutes=_get_int("ATC_RUNWAY_OPERATION_DURATION_MINUTES"),
        buffer_takeoff_minutes=_get_int("ATC_BUFFER_TAKEOFF_MINUTES", min_value=0),
        buffer_landing_minutes=_get_int("ATC_BUFFER_LANDING_MINUTES", min_value=0),
        buffer_mixed_minutes=_get_int("ATC_BUFFER_MIXED_MINUTES", min_value=0),
        gate_turnaround_minutes=_get_int("ATC_GATE_TURNAROUND_MINUTES", min_value=0),
        dependency_buffer_minutes=_get_int("ATC_DEPENDENCY_BUFFER_MINUTES", min_value=0),
        max_schedule_horizon_hours=_get_int("ATC_MAX_SCHEDULE_HORIZON_HOURS"),
    )


if __name__ == "__main__":
    # Quick standalone test: python config.py
    try:
        config = load_config()
        print("✅ Config loaded:")
        for field_name, field_value in config.__dict__.items():
            print(f"  {field_name}: {field_value}")
    except ConfigError as e:
        print(f"❌ Config error: {e}")
        raise SystemExit(1)