#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

API_URL="http://localhost:4000"
PAYMENT_URL="http://localhost:8002"
FILE_URL="http://localhost:8001"
NOTIFICATION_URL="http://localhost:4002"

echo "${BLUE}🚀 Starting Traffic Generation...${NC}"
echo "${YELLOW}Press Ctrl+C to stop.${NC}"

COUNT=0
MAX_REQUESTS=50

while [ $COUNT -lt $MAX_REQUESTS ]; do
  COUNT=$((COUNT+1))
  echo "\n${BLUE}--- Iteration $COUNT ---${NC}"

  # API Service
  echo "${GREEN}Calling API Service...${NC}"
  curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/v1/health"
  curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/v1/programs"
  # Simulate error
  curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/v1/non-existent-endpoint"

  # Payment Service
  echo "${GREEN}Calling Payment Service...${NC}"
  curl -s -o /dev/null -w "%{http_code}\n" "$PAYMENT_URL/health"
  curl -s -o /dev/null -w "%{http_code}\n" "$PAYMENT_URL/api/v1/payment-methods"
  # Simulate error for Payment
  curl -s -o /dev/null -w "%{http_code}\n" "$PAYMENT_URL/api/v1/non-existent"
  
  # File Service
  echo "${GREEN}Calling File Service...${NC}"
  curl -s -o /dev/null -w "%{http_code}\n" "$FILE_URL/"
  # Simulate error for File
  curl -s -o /dev/null -w "%{http_code}\n" "$FILE_URL/non-existent"
  
  # Notification Service (if HTTP is exposed)
  # echo "${GREEN}Calling Notification Service...${NC}"
  # curl -s -o /dev/null -w "%{http_code}\n" "$NOTIFICATION_URL/health" || true

  sleep 1
done

echo "${BLUE}✅ Traffic generation complete!${NC}"
