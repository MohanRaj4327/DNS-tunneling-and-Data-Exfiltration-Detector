from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./dnsentinel.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class DNSEvent(Base):
    __tablename__ = "dns_events"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(Float, index=True)
    source_ip = Column(String, index=True)
    query_name = Column(String, index=True)
    query_type = Column(Integer)
    response_code = Column(Integer)
    
    # Features
    query_length = Column(Integer)
    entropy = Column(Float)
    current_frequency = Column(Integer)
    baseline_frequency = Column(Float, nullable=True)
    frequency_multiplier = Column(Float)
    
    # Risk
    risk_score = Column(Integer, index=True)
    severity = Column(String, index=True) # LOW, MEDIUM, HIGH, CRITICAL
    
    # Explanations (Stored as JSON)
    tripwires = Column(JSON, default=list) # List of tripwire names
    reasons = Column(JSON, default=list)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
