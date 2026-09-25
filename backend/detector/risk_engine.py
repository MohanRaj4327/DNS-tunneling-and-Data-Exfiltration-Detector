from typing import Dict, Any, List

class RiskEngine:
    def __init__(self, weights: Dict[str, float] = None, severity_thresholds: Dict[str, int] = None):
        self.weights = weights or {
            "query_length": 0.30,   # Strong signal — tunneling uses long encoded subdomains
            "entropy": 0.40,        # Strongest signal — encoded data has high entropy
            "frequency": 0.15,
            "baseline": 0.15
        }
        
        self.severity_thresholds = severity_thresholds or {
            "LOW": 30,
            "MEDIUM": 60,
            "HIGH": 80,
            "CRITICAL": 100
        }

    def normalize_score(self, value: float, max_expected: float) -> float:
        """Normalize a value to 0-100 scale."""
        score = (value / max_expected) * 100
        return min(100.0, max(0.0, score))

    def calculate_risk(self, features: Dict[str, Any], tripwires: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculates a normalized 0-100 risk score based on features and tripwires."""
        
        # 1. Calculate component scores (0-100)
        # Tighter max_expected values to make scores more sensitive
        max_expected_len = 80.0    # 80+ chars = fully suspicious subdomain
        max_expected_ent = 4.5     # 4.5 bits = near-random character distribution
        max_expected_freq = 50.0   # 50 queries = heavy traffic
        max_expected_mult = 8.0    # 8x above baseline = very suspicious
        
        length_score = self.normalize_score(features.get("query_length", 0), max_expected_len)
        entropy_score = self.normalize_score(features.get("entropy", 0.0), max_expected_ent)
        frequency_score = self.normalize_score(features.get("current_frequency", 0), max_expected_freq)
        
        if features.get("insufficient_data", True):
            baseline_score = 0.0
        else:
            baseline_score = self.normalize_score(features.get("frequency_multiplier", 1.0), max_expected_mult)
            
        # 2. Apply weights
        raw_score = (
            length_score * self.weights["query_length"] +
            entropy_score * self.weights["entropy"] +
            frequency_score * self.weights["frequency"] +
            baseline_score * self.weights["baseline"]
        )
        
        # 3. Boost score based on tripwires — each tripwire is a hard signal
        tripwire_boost = len(tripwires) * 10.0  # +10 points per tripwire triggered
        
        final_score = min(100.0, raw_score + tripwire_boost)
        
        # 4. Tripwire gate: if NO tripwires fired, this is almost certainly a
        # normal domain. Scale it down to prevent false positives, while maintaining variety.
        real_tripwires = [t for t in tripwires if t["tripwire_name"] != "Multi-Indicator"]
        if len(real_tripwires) == 0:
            final_score = min(29.0, final_score * 0.7)
            
        final_score_int = int(round(final_score))
        
        # 4. Determine severity
        severity = "LOW"
        if final_score_int >= self.severity_thresholds["HIGH"]:
            severity = "CRITICAL" if final_score_int >= 90 else "HIGH" # Slightly adjust CRITICAL
        elif final_score_int >= self.severity_thresholds["MEDIUM"]:
            severity = "HIGH" if final_score_int >= 80 else "MEDIUM"
        elif final_score_int >= self.severity_thresholds["LOW"]:
            severity = "MEDIUM" if final_score_int >= 60 else "LOW"

        # Hardcode based on prompt: 0-29=LOW, 30-59=MEDIUM, 60-79=HIGH, 80-100=CRITICAL
        if final_score_int < 30:
            severity = "LOW"
        elif final_score_int < 60:
            severity = "MEDIUM"
        elif final_score_int < 80:
            severity = "HIGH"
        else:
            severity = "CRITICAL"
            
        return {
            "risk_score": final_score_int,
            "severity": severity,
            "components": {
                "length_score": int(length_score),
                "entropy_score": int(entropy_score),
                "frequency_score": int(frequency_score),
                "baseline_score": int(baseline_score)
            }
        }

    def generate_explanations(self, tripwires: List[Dict[str, Any]], risk_score: int) -> Dict[str, Any]:
        """Generate human-readable explanations based on triggered tripwires."""
        reasons = [tw["reason"] for tw in tripwires]
        
        if risk_score >= 60:
            assessment = "This activity exhibits characteristics associated with potential DNS tunneling or data exfiltration."
            action = "Investigate the source device and review related DNS activity."
            status = "POTENTIALLY_SUSPICIOUS"
        else:
            assessment = "This activity appears normal or lacks strong indicators of anomalous behavior."
            action = "No immediate action required."
            status = "LOW_RISK"
            if not reasons:
                reasons = ["No unusual DNS behavior detected."]
                
        return {
            "reasons": reasons,
            "assessment": assessment,
            "recommended_action": action,
            "status": status
        }
