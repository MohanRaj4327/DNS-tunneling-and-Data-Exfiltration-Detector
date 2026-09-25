import pytest
from backend.detector.features import (
    calculate_query_length,
    calculate_subdomain_length,
    calculate_entropy,
    calculate_unique_subdomain_count
)

def test_query_length():
    assert calculate_query_length("example.com") == 11
    assert calculate_query_length("a.b.c.example.com.") == 17
    assert calculate_query_length("") == 0

def test_subdomain_length():
    assert calculate_subdomain_length("example.com") == 0
    assert calculate_subdomain_length("www.example.com") == 3
    assert calculate_subdomain_length("very.long.sub.example.com") == 13

def test_entropy():
    # Low entropy (repeated)
    assert calculate_entropy("aaaaaaaa.com") < 2.5
    # High entropy (random)
    assert calculate_entropy("a1b2c3d4e5f6.com") > 3.0
    assert calculate_entropy("") == 0.0

def test_unique_subdomain_count():
    assert calculate_unique_subdomain_count("example.com") == 0
    assert calculate_unique_subdomain_count("www.example.com") == 1
    assert calculate_unique_subdomain_count("a.b.c.example.com") == 3
