from minio import Minio
import os

print("Connecting to DigitalOcean Spaces...")
client = Minio(
    "sgp1.digitaloceanspaces.com",
    access_key="DO8012CX8TABTCJ27HVD",
    secret_key="U5G6aXx6OnFokE9w2xOD7VCzS2yf81ZSChJp0729HFU",
    secure=True, 
    region="sgp1"
)

print("Listing buckets...")
try:
    buckets = client.list_buckets()
    for b in buckets:
        print(f" - {b.name}")
except Exception as e:
    print(f"Error listing buckets: {e}")

print("Checking 'ybb-assets-dev'...")
try:
    exists = client.bucket_exists("ybb-assets-dev")
    print(f"Exists: {exists}")
    if not exists:
         print("Attempting to create bucket...")
         client.make_bucket("ybb-assets-dev")
         print("Created!")
except Exception as e:
    print(f"Error checking/creating bucket: {e}")
