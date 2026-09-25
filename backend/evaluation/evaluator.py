import csv
import io
from typing import List, Dict, Any

class Evaluator:
    def __init__(self, detector):
        self.detector = detector

    def process_csv(self, file_content: str) -> Dict[str, Any]:
        reader = csv.DictReader(io.StringIO(file_content))
        
        required_cols = {"timestamp", "source_ip", "query_name", "query_type", "response_code"}
        if not required_cols.issubset(set(reader.fieldnames or [])):
            return {"error": f"Missing required columns. Found: {reader.fieldnames}"}

        has_labels = "expected_label" in reader.fieldnames
        
        results = []
        
        tp = 0
        tn = 0
        fp = 0
        fn = 0
        
        for row in reader:
            try:
                timestamp = float(row["timestamp"])
                source_ip = row["source_ip"]
                domain = row["query_name"]
                
                # Run through actual detector
                analysis = self.detector.analyze(source_ip, domain, timestamp)
                
                predicted_suspicious = analysis["risk"]["risk_score"] >= 60
                
                if has_labels:
                    # Treat '1', 'true', 'malicious', 'suspicious' as positive labels
                    label_str = row["expected_label"].lower().strip()
                    actual_suspicious = label_str in ("1", "true", "malicious", "suspicious", "anomaly")
                    
                    if predicted_suspicious and actual_suspicious:
                        tp += 1
                    elif not predicted_suspicious and not actual_suspicious:
                        tn += 1
                    elif predicted_suspicious and not actual_suspicious:
                        fp += 1
                    elif not predicted_suspicious and actual_suspicious:
                        fn += 1

                results.append({
                    "timestamp": timestamp,
                    "domain": domain,
                    "risk_score": analysis["risk"]["risk_score"],
                    "severity": analysis["risk"]["severity"],
                })
            except Exception as e:
                continue # Skip malformed rows
                
        metrics = {}
        if has_labels:
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
            accuracy = (tp + tn) / (tp + tn + fp + fn) if (tp + tn + fp + fn) > 0 else 0.0
            
            metrics = {
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1_score": round(f1, 4),
                "accuracy": round(accuracy, 4),
                "confusion_matrix": {
                    "true_positive": tp,
                    "true_negative": tn,
                    "false_positive": fp,
                    "false_negative": fn
                }
            }
            
        return {
            "processed_rows": len(results),
            "metrics": metrics,
            "has_labels": has_labels
        }
