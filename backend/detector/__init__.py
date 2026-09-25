from .features import (
    calculate_query_length,
    calculate_subdomain_length,
    calculate_entropy,
    calculate_unique_subdomain_count
)
from .baseline import BaselineEngine
from .tripwires import TripwireEngine
from .risk_engine import RiskEngine

class DetectionEngine:
    def __init__(self):
        self.baseline = BaselineEngine()
        self.tripwires = TripwireEngine()
        self.risk = RiskEngine()
        
    def analyze(self, source_ip: str, domain: str, timestamp: float = None) -> dict:
        """Runs the full detection pipeline on a single query."""
        
        # 1. Feature Extraction
        q_len = calculate_query_length(domain)
        sub_len = calculate_subdomain_length(domain)
        entropy = calculate_entropy(domain)
        sub_count = calculate_unique_subdomain_count(domain)
        
        # 2. Baseline & Frequency
        self.baseline.observe(source_ip, domain, timestamp)
        freq_stats = self.baseline.analyze_frequency(source_ip, domain, timestamp)
        
        features = {
            "query_length": q_len,
            "subdomain_length": sub_len,
            "entropy": entropy,
            "unique_subdomain_count": sub_count,
            **freq_stats
        }
        
        # 3. Tripwires
        triggered_tripwires = self.tripwires.evaluate(features)
        
        # 4. Risk Engine
        risk_results = self.risk.calculate_risk(features, triggered_tripwires)
        
        # 5. Explanations
        explanations = self.risk.generate_explanations(triggered_tripwires, risk_results["risk_score"])
        
        return {
            "domain": domain,
            "source_ip": source_ip,
            "features": features,
            "tripwires": triggered_tripwires,
            "risk": risk_results,
            "explanation": explanations
        }
