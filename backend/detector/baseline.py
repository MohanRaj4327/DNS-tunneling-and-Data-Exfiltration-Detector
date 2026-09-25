from typing import Dict, Optional, Tuple
import time

class BaselineEngine:
    def __init__(self, observation_window_seconds: int = 60, min_observations: int = 5):
        self.observation_window = observation_window_seconds
        self.min_observations = min_observations
        
        # In-memory store: (source_ip, domain) -> list of timestamps
        self.history: Dict[Tuple[str, str], list[float]] = {}
        
        # (source_ip, domain) -> calculated baseline frequency (queries per window)
        self.baselines: Dict[Tuple[str, str], float] = {}

    def observe(self, source_ip: str, domain: str, timestamp: float = None):
        """Record an observation of a domain from a source IP."""
        if timestamp is None:
            timestamp = time.time()
            
        key = (source_ip, domain)
        if key not in self.history:
            self.history[key] = []
            
        self.history[key].append(timestamp)
        self._cleanup_old(key, timestamp)
        
    def _cleanup_old(self, key: Tuple[str, str], current_time: float):
        """Remove timestamps older than our history limit (e.g., last 24h).
        For simplicity, we'll keep up to 1 hour of history for baseline calculation.
        """
        history_limit = current_time - 3600
        self.history[key] = [ts for ts in self.history[key] if ts >= history_limit]

    def get_current_frequency(self, source_ip: str, domain: str, current_time: float = None) -> int:
        """Get the number of queries in the current observation window."""
        if current_time is None:
            current_time = time.time()
            
        key = (source_ip, domain)
        if key not in self.history:
            return 0
            
        window_start = current_time - self.observation_window
        count = sum(1 for ts in self.history[key] if ts >= window_start)
        return count

    def get_baseline_frequency(self, source_ip: str, domain: str) -> Optional[float]:
        """Get the historical baseline frequency per observation window."""
        key = (source_ip, domain)
        if key not in self.history or len(self.history[key]) < self.min_observations:
            return None # Insufficient data
            
        # Simplistic baseline: average frequency per window over the available history
        times = sorted(self.history[key])
        if len(times) < 2:
            return None
            
        time_span = times[-1] - times[0]
        if time_span == 0:
            return None
            
        # Extrapolate to queries per observation window
        rate_per_second = len(times) / time_span
        baseline = rate_per_second * self.observation_window
        return baseline
        
    def analyze_frequency(self, source_ip: str, domain: str, current_time: float = None) -> dict:
        """Returns the current frequency, baseline, and deviation."""
        current_freq = self.get_current_frequency(source_ip, domain, current_time)
        baseline = self.get_baseline_frequency(source_ip, domain)
        
        if baseline is None or baseline == 0:
            return {
                "current_frequency": current_freq,
                "baseline_frequency": None,
                "frequency_multiplier": 1.0,
                "insufficient_data": True
            }
            
        multiplier = current_freq / baseline if baseline > 0 else 1.0
        
        return {
            "current_frequency": current_freq,
            "baseline_frequency": baseline,
            "frequency_multiplier": multiplier,
            "insufficient_data": False
        }
