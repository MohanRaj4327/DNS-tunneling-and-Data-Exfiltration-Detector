from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AnalyzeRequest(BaseModel):
    timestamp: float
    source_ip: str
    query_name: str
    query_type: int
    response_code: int

class AnalyzeResponse(BaseModel):
    domain: str
    risk_score: int
    severity: str
    status: str
    components: Dict[str, int]
    features: Dict[str, Any]
    triggered_tripwires: List[str]
    explanation: List[str]
    recommended_action: str

class AlertResponse(BaseModel):
    id: int
    timestamp: float
    source_ip: str
    query_name: str
    risk_score: int
    severity: str
    tripwires: List[str]
    reasons: List[str]
    query_length: Optional[int] = 0
    entropy: Optional[float] = 0.0
    current_frequency: Optional[int] = 0

class DeviceSummary(BaseModel):
    source_ip: str
    total_queries: int
    suspicious_queries: int
    average_risk: float
    peak_risk: int
    status: str

class DomainSummary(BaseModel):
    domain: str
    total_queries: int
    average_risk: float
    peak_risk: int
