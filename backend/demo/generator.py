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

class DemoManager:
    def __init__(self, api_url="http://127.0.0.1:8000/api/analyze"):
        self.api_url = api_url
        self.is_running = False
        
    def stop_demo(self):
        self.is_running = False

    def start_demo(self):
        if self.is_running:
            return False
            
        self.is_running = True
        
        def run():
            source_ip = "192.168.1.105"
            try:
                while self.is_running:
                    # 1. Normal traffic phase
                    for _ in range(8):
                        if not self.is_running: return
                        domain = f"www.{generate_random_domain(6)}.com"
                        requests.post(self.api_url, json={
                            "timestamp": time.time(),
                            "source_ip": source_ip,
                            "query_name": domain,
                            "query_type": 1,
                            "response_code": 0
                        })
                        time.sleep(1.0)
                        
                    # 2. Suspicious traffic burst phase
                    tunnel_domain = "evil-tunnel.net"
                    for i in range(12):
                        if not self.is_running: return
                        sub_len = 50 + (i * 2)
                        subdomain = generate_random_domain(sub_len, entropy=True)
                        domain = f"{subdomain}.{tunnel_domain}"
                        requests.post(self.api_url, json={
                            "timestamp": time.time(),
                            "source_ip": source_ip,
                            "query_name": domain,
                            "query_type": 1,
                            "response_code": 0
                        })
                        time.sleep(0.3)
            except Exception as e:
                print("Demo sequence error:", e)
            finally:
                self.is_running = False
                
        t = threading.Thread(target=run)
        t.daemon = True
        t.start()
        return True
