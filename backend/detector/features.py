import math
from collections import Counter

def calculate_query_length(domain: str) -> int:
    """Calculate the total length of the query name (excluding trailing dot)."""
    if not domain:
        return 0
    clean_domain = domain.rstrip('.')
    return len(clean_domain)

def calculate_subdomain_length(domain: str) -> int:
    """Calculate the length of the subdomain part (excluding TLD and domain)."""
    if not domain:
        return 0
    clean_domain = domain.rstrip('.')
    parts = clean_domain.split('.')
    if len(parts) <= 2:
        return 0
    # Everything before the last two parts is considered subdomain here for simplicity
    subdomain_parts = parts[:-2]
    return len('.'.join(subdomain_parts))

def calculate_entropy(domain: str) -> float:
    """Calculate the Shannon entropy of the domain string."""
    if not domain:
        return 0.0
    
    clean_domain = domain.rstrip('.')
    # We may want to calculate entropy of the full domain or just the subdomain
    # Full domain entropy is safer.
    
    if len(clean_domain) == 0:
        return 0.0
        
    counts = Counter(clean_domain)
    length = len(clean_domain)
    
    entropy = 0.0
    for count in counts.values():
        probability = count / length
        entropy -= probability * math.log2(probability)
        
    return entropy

def calculate_unique_subdomain_count(domain: str) -> int:
    """Count the number of subdomains in a query."""
    if not domain:
        return 0
    clean_domain = domain.rstrip('.')
    parts = clean_domain.split('.')
    if len(parts) <= 2:
        return 0
    return len(parts) - 2

