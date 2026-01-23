import time
import requests
import grpc
import os
import sys

# Add current dir to path to find generated protos
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'services/file/app/protos'))

# from services.file.app.protos import file_service_pb2, file_service_pb2_grpc

FILE_SIZE_MB = 10
FILE_SIZE_BYTES = FILE_SIZE_MB * 1024 * 1024
TEST_FILE_PATH = "test_large_file.bin"
API_REST_URL = "http://localhost:4000/v1/rest-files-test/upload"
API_GRPC_TEST_URL = "http://localhost:4000/v1/grpc-files/upload"

def create_test_file(path, size_mb):
    print(f"Generating {size_mb}MB test file at {path}...")
    with open(path, "wb") as f:
        f.write(os.urandom(int(size_mb * 1024 * 1024)))

def test_rest_upload(file_path):
    print(f"Testing REST Upload ({file_path})...")
    start = time.time()
    with open(file_path, "rb") as f:
        files = {'file': (os.path.basename(file_path), f, 'application/pdf')}
        data = {
            'user_id': 'test-user',
            'brand_id': 'test-brand',
            'bucket': 'documents'
        }
        response = requests.post(API_REST_URL, files=files, data=data)
    
    end = time.time()
    duration = end - start
    if response.status_code == 201:
        print(f"REST Upload Success. Time: {duration:.4f}s")
    else:
        print(f"REST Upload Failed: {response.status_code} - {response.text}")
    return duration

def test_grpc_upload(file_path):
    print(f"Testing gRPC Upload via Gateway ({file_path})...")
    start = time.time()
    with open(file_path, "rb") as f:
        files = {'file': (os.path.basename(file_path), f, 'application/pdf')}
        data = {
            'user_id': 'test-user',
            'brand_id': 'test-brand',
            'bucket': 'documents'
        }
        response = requests.post(API_GRPC_TEST_URL, files=files, data=data)

    end = time.time()
    duration = end - start
    if response.status_code == 201:
        print(f"gRPC Upload Success. Time: {duration:.4f}s")
    else:
        print(f"gRPC Upload Failed: {response.status_code} - {response.text}")
    return duration

def run_suite(size_mb):
    filename = f"test_{size_mb}mb.pdf"
    create_test_file(filename, size_mb)
    
    print(f"\n--- Benchmark Suite: {size_mb}MB ---")
    rest_time = test_rest_upload(filename)
    grpc_time = test_grpc_upload(filename)
    
    print(f"\nResults for {size_mb}MB:")
    print(f"REST: {rest_time:.4f}s")
    print(f"gRPC: {grpc_time:.4f}s")
    
    if rest_time > 0 and grpc_time > 0:
        if grpc_time < rest_time:
            diff = (rest_time - grpc_time) / rest_time * 100
            print(f"👉 gRPC is {diff:.2f}% faster")
        else:
            diff = (grpc_time - rest_time) / rest_time * 100
            print(f"👉 gRPC is {diff:.2f}% slower")
            
    if os.path.exists(filename):
        os.remove(filename)

if __name__ == "__main__":
    # Warmup
    print("Warming up with 0.1MB...")
    run_suite(0.1) 
    
    # Normal files
    run_suite(1)   # 1MB (High quality image)
    run_suite(5)   # 5MB (Small document/asset)
