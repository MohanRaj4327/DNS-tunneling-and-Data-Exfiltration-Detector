import socket
import logging
from dnslib import DNSRecord
import time
import requests

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("DNSMonitor")

class DNSMonitorServer:
    def __init__(self, host='127.0.0.1', port=53, upstream='8.8.8.8', upstream_port=53, api_url='http://127.0.0.1:8000/api/analyze'):
        self.host = host
        self.port = port
        self.upstream = upstream
        self.upstream_port = upstream_port
        self.api_url = api_url
        self.is_running = False
        self.sock = None
        self.query_count = 0
        self.last_query = None

    def start(self):
        self.is_running = True
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.bind((self.host, self.port))
            logger.info(f"DNS Monitor listening on {self.host}:{self.port}")
            logger.info(f"Forwarding to upstream {self.upstream}:{self.upstream_port}")
            
            while self.is_running:
                try:
                    data, addr = self.sock.recvfrom(8192)
                    self.handle_request(data, addr)
                except socket.timeout:
                    continue
                except Exception as e:
                    if self.is_running:
                        logger.error(f"Error receiving data: {e}")
        except Exception as e:
            logger.error(f"Failed to start DNS monitor: {e}")
            self.is_running = False

    def stop(self):
        self.is_running = False
        if self.sock:
            self.sock.close()
        logger.info("DNS Monitor stopped.")

    def handle_request(self, data, addr):
        timestamp = time.time()
        try:
            request = DNSRecord.parse(data)
            qname = str(request.q.qname)
            qtype = request.q.qtype
            source_ip = addr[0]

            self.query_count += 1
            self.last_query = qname

            logger.info(f"Received query from {source_ip}: {qname} (Type {qtype})")

            # Forward upstream
            response_data = self.forward_upstream(data)
            if response_data:
                self.sock.sendto(response_data, addr)
                
                # Try to extract response code from response
                try:
                    response_record = DNSRecord.parse(response_data)
                    rcode = response_record.header.rcode
                except:
                    rcode = 0
            else:
                rcode = 2 # SERVFAIL as fallback

            # Send to analysis API asynchronously (in a real production app we'd use a queue/background task)
            # For hackathon simplicity, we send it synchronously or fire-and-forget
            try:
                payload = {
                    "timestamp": timestamp,
                    "source_ip": source_ip,
                    "query_name": qname,
                    "query_type": qtype,
                    "response_code": rcode
                }
                # Fire and forget with short timeout
                requests.post(self.api_url, json=payload, timeout=0.1)
            except Exception as e:
                # API might be offline, ignore to avoid blocking DNS resolution
                pass

        except Exception as e:
            logger.error(f"Error handling DNS request: {e}")

    def forward_upstream(self, data):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as proxy_sock:
                proxy_sock.settimeout(2.0)
                proxy_sock.sendto(data, (self.upstream, self.upstream_port))
                response, _ = proxy_sock.recvfrom(8192)
                return response
        except Exception as e:
            logger.error(f"Error forwarding to upstream: {e}")
            return None

if __name__ == '__main__':
    # Default development run
    server = DNSMonitorServer(port=5353) # Use 5353 to avoid admin requirement by default
    try:
        server.start()
    except KeyboardInterrupt:
        server.stop()
