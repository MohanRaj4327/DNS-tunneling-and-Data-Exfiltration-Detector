import pytest
from backend.detector.risk_engine import RiskEngine

def test_risk_normalization():
    engine = RiskEngine()
    assert engine.normalize_score(50, 100) == 50.0
    assert engine.normalize_score(150, 100) == 100.0 # Capped at 100
    assert engine.normalize_score(-10, 100) == 0.0 # Min 0

def test_risk_calculation():
    engine = RiskEngine()
    features = {
        "query_length": 150,
        "entropy": 5.0,
        "current_frequency": 100,
        "frequency_multiplier": 10.0,
        "insufficient_data": False
    }
    
    tripwires = [{"tripwire_name": "Test", "reason": "Test"}]
    
    risk = engine.calculate_risk(features, tripwires)
    assert risk["risk_score"] == 100 # Should max out
    assert risk["severity"] == "CRITICAL"
    
def test_low_risk_calculation():
    engine = RiskEngine()
    features = {
        "query_length": 10,
        "entropy": 2.0,
        "current_frequency": 1,
        "frequency_multiplier": 1.0,
        "insufficient_data": False
    }
    
    risk = engine.calculate_risk(features, [])
    assert risk["risk_score"] < 40
    assert risk["severity"] in ["LOW", "MEDIUM"]
