from typing import Dict, List, Any

class TripwireEngine:
    def __init__(self, config: Dict[str, float] = None):
        # Default thresholds
        self.config = config or {
            "query_length_threshold": 50,        # DNS tunneling subdomains are typically 50+ chars
            "entropy_threshold": 3.5,            # Normal domains are ~2.5-3.0; encoded data is 3.5+
            "frequency_spike_threshold": 20,     # 20+ queries in window is suspicious
            "baseline_deviation_multiplier": 3.0 # 3x above baseline is suspicious
        }
        
    def evaluate(self, features: Dict[str, Any]) -> List[Dict[str, Any]]:
        triggered = []
        
        # A. Long Query Tripwire
        q_len = features.get("query_length", 0)
        len_thresh = self.config["query_length_threshold"]
        if q_len > len_thresh:
            triggered.append({
                "tripwire_name": "Long Query",
                "threshold": len_thresh,
                "observed_value": q_len,
                "reason": "Query length is significantly above the configured threshold."
            })
            
        # B. High Entropy Tripwire
        ent = features.get("entropy", 0.0)
        ent_thresh = self.config["entropy_threshold"]
        if ent > ent_thresh:
            triggered.append({
                "tripwire_name": "High Entropy",
                "threshold": ent_thresh,
                "observed_value": round(ent, 3),
                "reason": "Character entropy is unusually high."
            })
            
        # C. Frequency Spike Tripwire
        freq = features.get("current_frequency", 0)
        freq_thresh = self.config["frequency_spike_threshold"]
        if freq > freq_thresh:
            triggered.append({
                "tripwire_name": "Frequency Spike",
                "threshold": freq_thresh,
                "observed_value": freq,
                "reason": "Query frequency is unusually high in absolute terms."
            })
            
        # D. Baseline Deviation Tripwire
        baseline_mult = features.get("frequency_multiplier", 1.0)
        mult_thresh = self.config["baseline_deviation_multiplier"]
        insufficient = features.get("insufficient_data", True)
        
        if not insufficient and baseline_mult > mult_thresh:
            triggered.append({
                "tripwire_name": "Baseline Deviation",
                "threshold": mult_thresh,
                "observed_value": round(baseline_mult, 2),
                "reason": "Query frequency is significantly above historical baseline."
            })
            
        # E. Multi-Indicator Tripwire
        if len(triggered) >= 2:
            triggered.append({
                "tripwire_name": "Multi-Indicator",
                "threshold": 2,
                "observed_value": len(triggered),
                "reason": "Multiple anomaly indicators triggered simultaneously."
            })
            
        return triggered
