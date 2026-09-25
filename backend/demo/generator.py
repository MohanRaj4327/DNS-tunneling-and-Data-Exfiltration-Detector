import time
import requests
import random
import string
import threading

def generate_random_domain(length=10, entropy=False):
    if entropy:
        chars = string.ascii_letters + string.digits
    else:
        chars = 'abcdefghijklmnopqrstuvwxyz'
    return ''.join(random.choice(chars) for _ in range(length))

def run_demo_sequence(api_url: str):
    source_ip = "192.168.1.105"
    
    # 1. Normal traffic (10 queries)
    for _ in range(10):
        domain = f"www.{generate_random_domain(6)}.com"
        requests.post(api_url, json={
            "timestamp": time.time(),
            "source_ip": source_ip,
            "query_name": domain,
            "query_type": 1,
            "response_code": 0
        })
        time.sleep(0.5)
        
    # 2. Suspicious traffic (increasing length, entropy, frequency)
    tunnel_domain = "evil-tunnel.net"
    
    for i in range(30):
        # Long subdomain with high entropy
        sub_len = 50 + (i * 2) # Increases over time
        subdomain = generate_random_domain(sub_len, entropy=True)
        domain = f"{subdomain}.{tunnel_domain}"
        
        requests.post(api_url, json={
            "timestamp": time.time(),
            "source_ip": source_ip,
            "query_name": domain,
            "query_type": 1,
            "response_code": 0
        })
        # Fast frequency spike
        time.sleep(0.1)

class DemoManager:
    def __init__(self, api_url="http://127.0.0.1:8000/api/analyze"):
        self.api_url = api_url
        self.is_running = False
        
    def start_demo(self):
        if self.is_running:
            return False
            
        self.is_running = True
        
        def run():
            try:
                run_demo_sequence(self.api_url)
            finally:
                self.is_running = False
                
        t = threading.Thread(target=run)
        t.daemon = True
        t.start()
        return True
