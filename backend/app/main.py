import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
import time
from typing import List

from backend.app.db import get_db, init_db, DNSEvent
from backend.app.schemas import AnalyzeRequest, AnalyzeResponse, AlertResponse, DeviceSummary, DomainSummary
from backend.detector import DetectionEngine
from backend.evaluation.evaluator import Evaluator
from backend.demo.generator import DemoManager

app = FastAPI(title="DNSentinel API")

demo_manager = DemoManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow local React app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global detection engine instance
detector = DetectionEngine()

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/status")
def get_status():
    return {
        "api": "ONLINE",
        "database": "ONLINE",
        "monitor": "UNKNOWN" # To be implemented via shared state or pinging monitor
    }

@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_dns(request: AnalyzeRequest, db: Session = Depends(get_db)):
    """Analyze a single DNS query and store the result."""
    # Normalize domain: lowercase and remove trailing dot
    normalized_domain = request.query_name.lower().rstrip('.')
    
    result = detector.analyze(request.source_ip, normalized_domain, request.timestamp)
    
    tripwire_names = [t["tripwire_name"] for t in result["tripwires"]]
    
    # Store in DB
    db_event = DNSEvent(
        timestamp=request.timestamp,
        source_ip=request.source_ip,
        query_name=normalized_domain,
        query_type=request.query_type,
        response_code=request.response_code,
        query_length=result["features"]["query_length"],
        entropy=result["features"]["entropy"],
        current_frequency=result["features"]["current_frequency"],
        baseline_frequency=result["features"]["baseline_frequency"],
        frequency_multiplier=result["features"]["frequency_multiplier"],
        risk_score=result["risk"]["risk_score"],
        severity=result["risk"]["severity"],
        tripwires=tripwire_names,
        reasons=result["explanation"]["reasons"]
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    return AnalyzeResponse(
        domain=request.query_name,
        risk_score=result["risk"]["risk_score"],
        severity=result["risk"]["severity"],
        status=result["explanation"]["status"],
        components=result["risk"]["components"],
        features=result["features"],
        triggered_tripwires=tripwire_names,
        explanation=result["explanation"]["reasons"],
        recommended_action=result["explanation"]["recommended_action"]
    )

@app.get("/api/alerts", response_model=List[AlertResponse])
def get_alerts(db: Session = Depends(get_db), limit: int = 100):
    events = db.query(DNSEvent).filter(DNSEvent.risk_score >= 60).order_by(DNSEvent.timestamp.desc()).limit(limit).all()
    return events

@app.get("/api/queries", response_model=List[AlertResponse])
def get_queries(db: Session = Depends(get_db), limit: int = 50):
    # Returns all queries (normal, medium, high)
    events = db.query(DNSEvent).order_by(DNSEvent.timestamp.desc()).limit(limit).all()
    return events

@app.get("/api/alerts/{id}", response_model=AlertResponse)
def get_alert(id: int, db: Session = Depends(get_db)):
    event = db.query(DNSEvent).filter(DNSEvent.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Alert not found")
    return event

@app.get("/api/devices", response_model=List[DeviceSummary])
def get_devices(db: Session = Depends(get_db)):
    devices = []
    # Simple aggregation (In prod, use group_by queries)
    ips = db.query(DNSEvent.source_ip).distinct().all()
    for (ip,) in ips:
        events = db.query(DNSEvent).filter(DNSEvent.source_ip == ip).all()
        total = len(events)
        suspicious = sum(1 for e in events if e.risk_score >= 60)
        avg_risk = sum(e.risk_score for e in events) / total if total > 0 else 0
        peak_risk = max((e.risk_score for e in events), default=0)
        
        status = "POTENTIALLY_SUSPICIOUS" if suspicious > 0 else "NORMAL"
        
        devices.append(DeviceSummary(
            source_ip=ip,
            total_queries=total,
            suspicious_queries=suspicious,
            average_risk=avg_risk,
            peak_risk=peak_risk,
            status=status
        ))
    return devices

@app.get("/api/risk/{domain}")
def get_domain_risk(domain: str, source: str = "hover", db: Session = Depends(get_db)):
    """
    Extension endpoint — instantly scores domains via static analysis.
    """
    normalized_domain = domain.lower().rstrip('.')
    result = detector.analyze_static(normalized_domain)
    
    # Save navigation events to dashboard history
    if source == "navigation":
        db_event = DNSEvent(
            timestamp=time.time(),
            source_ip="Chrome Browser",
            query_name=normalized_domain,
            query_type=1,
            response_code=0,
            query_length=result["features"]["query_length"],
            entropy=result["features"]["entropy"],
            risk_score=result["risk"]["risk_score"],
            severity=result["risk"]["severity"],
            reasons=result["explanation"]["reasons"],
            tripwires=[t["tripwire_name"] for t in result["tripwires"]]
        )
        db.add(db_event)
        db.commit()

    return {
        "domain": normalized_domain,
        "risk_score": result["risk"]["risk_score"],
        "severity": result["risk"]["severity"],
        "status": result["explanation"]["status"],
        "explanation": result["explanation"]["reasons"],
        "triggered_tripwires": [t["tripwire_name"] for t in result["tripwires"]],
        "timestamp": time.time()
    }

from fastapi.responses import HTMLResponse
import os

@app.get("/demo", response_class=HTMLResponse)
def serve_demo():
    demo_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "demo.html")
    with open(demo_path, "r", encoding="utf-8") as f:
        return f.read()

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        return {"error": "Upload failed. Only CSV files are supported."}
    
    content = await file.read()
    evaluator = Evaluator(detector)
    try:
        results = evaluator.process_csv(content.decode("utf-8"))
        if "error" in results:
             raise HTTPException(status_code=400, detail=results["error"])
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Upload failed: {str(e)}")

@app.post("/api/demo/start")
def start_demo():
    if demo_manager.start_demo():
        return {"status": "Demo started"}
    return {"status": "Demo already running"}

@app.post("/api/demo/reset")
def reset_demo(db: Session = Depends(get_db)):
    global detector
    demo_manager.stop_demo()
    # Wait briefly for thread to exit
    time.sleep(0.5)
    # Reset in-memory detector state
    detector = DetectionEngine()
    # Clear database
    db.query(DNSEvent).delete()
    db.commit()
    return {"status": "Demo and database reset successfully"}
