import time
import requests
import grpc
import os
import sys

# Add current dir to path to find generated protos
sys.path.append(os.getcwd())

# from services.file.app.protos import file_service_pb2, file_service_pb2_grpc

FILE_SIZE_MB = 10
FILE_SIZE_BYTES = FILE_SIZE_MB * 1024 * 1024
TEST_FILE_PATH = "test_large_file.bin"
API_REST_URL = "http://localhost:4000/files/upload" # Via Gateway
API_GRPC_TEST_URL = "http://localhost:4000/grpc-files/upload" # Via Gateway calling gRPC

def create_test_file():
    print(f"Generating {FILE_SIZE_MB}MB test file...")
    with open(TEST_FILE_PATH, "wb") as f:
        f.write(os.urandom(FILE_SIZE_BYTES))

def test_rest_upload():
    print(f"Testing REST Upload ({FILE_SIZE_MB}MB)...")
    start = time.time()
    with open(TEST_FILE_PATH, "rb") as f:
        files = {'file': f}
        data = {
            'user_id': 'test-user',
            'brand_id': 'test-brand',
            'bucket': 'temp'
        }
        # Note: This hits the API Gateway which forwards to File Service via HTTP
        # To truly test the Inter-Service communication comparison, users usually hit the Gateway.
        # But this test sends file TO Gateway.
        # Ideally we want to measure Gateway -> File Service latency.
        # But end-to-end is also valuable as it includes the overhead of the Gateway parsing the file.
        response = requests.post(API_REST_URL, files=files, data=data)
    
    end = time.time()
    duration = end - start
    if response.status_code == 201:
        print(f"REST Upload Success. Time: {duration:.4f}s")
    else:
        print(f"REST Upload Failed: {response.status_code} - {response.text}")
    return duration

def test_grpc_upload():
    print(f"Testing gRPC Upload via Gateway ({FILE_SIZE_MB}MB)...")
    start = time.time()
    with open(TEST_FILE_PATH, "rb") as f:
        files = {'file': f}
        data = {
            'user_id': 'test-user',
            'brand_id': 'test-brand',
            'bucket': 'temp'
        }
        # This hits the new endpoint in Gateway which parses Multipart, then streams to File Service via gRPC
        response = requests.post(API_GRPC_TEST_URL, files=files, data=data)

    end = time.time()
    duration = end - start
    if response.status_code == 201:
        print(f"gRPC Upload Success. Time: {duration:.4f}s")
    else:
        print(f"gRPC Upload Failed: {response.status_code} - {response.text}")
    return duration

if __name__ == "__main__":
    if not os.path.exists(TEST_FILE_PATH):
        create_test_file()
    
    # Warmup
    print("Warming up...")
    # time.sleep(2)
    
    # Run Tests
    rest_time = test_rest_upload()
    grpc_time = test_grpc_upload()
    
    print("\nResults:")
    print(f"REST Total Time: {rest_time:.4f}s")
    print(f"gRPC Total Time: {grpc_time:.4f}s")
    
    if rest_time > 0 and grpc_time > 0:
        diff = (rest_time - grpc_time) / rest_time * 100
        if diff > 0:
            print(f"gRPC is {diff:.2f}% faster")
        else:
            print(f"gRPC is {abs(diff):.2f}% slower")

    # Cleanup
    if os.path.exists(TEST_FILE_PATH):
        os.remove(TEST_FILE_PATH)
