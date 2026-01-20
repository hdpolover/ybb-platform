#!/bin/bash

# VPS Deployment and Monitoring Script for YBB Platform
# This script helps deploy and monitor the Next.js admin dashboard

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="ybb-admin-dashboard"
MAX_CPU_PERCENT=100  # Alert if CPU usage exceeds 100%
MAX_MEMORY_MB=400    # Alert if memory usage exceeds 400MB

echo -e "${GREEN}=== YBB Platform - Admin Dashboard Deployment & Monitoring ===${NC}\n"

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not running${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker is running${NC}"
}

# Function to stop and remove old container
cleanup_old_container() {
    echo -e "\n${YELLOW}Cleaning up old containers...${NC}"
    if docker ps -a | grep -q $CONTAINER_NAME; then
        docker stop $CONTAINER_NAME 2>/dev/null || true
        docker rm $CONTAINER_NAME 2>/dev/null || true
        echo -e "${GREEN}✓ Old container removed${NC}"
    else
        echo -e "${GREEN}✓ No old container to remove${NC}"
    fi
}

# Function to pull latest images
pull_images() {
    echo -e "\n${YELLOW}Pulling latest images...${NC}"
    docker-compose -f docker-compose.vps.yml pull admin-dashboard
    echo -e "${GREEN}✓ Images pulled${NC}"
}

# Function to rebuild and restart
rebuild_and_restart() {
    echo -e "\n${YELLOW}Rebuilding and restarting admin dashboard...${NC}"
    docker-compose -f docker-compose.vps.yml up -d --build --force-recreate admin-dashboard
    echo -e "${GREEN}✓ Admin dashboard restarted${NC}"
}

# Function to check container health
check_health() {
    echo -e "\n${YELLOW}Checking container health...${NC}"
    
    # Wait for container to start
    sleep 5
    
    if docker ps | grep -q $CONTAINER_NAME; then
        echo -e "${GREEN}✓ Container is running${NC}"
        
        # Check health status
        HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "no-healthcheck")
        echo -e "Health Status: ${GREEN}$HEALTH_STATUS${NC}"
        
        # Show resource usage
        show_resource_usage
    else
        echo -e "${RED}✗ Container is not running${NC}"
        echo -e "\n${YELLOW}Container logs:${NC}"
        docker logs --tail 50 $CONTAINER_NAME
        exit 1
    fi
}

# Function to show resource usage
show_resource_usage() {
    echo -e "\n${YELLOW}Current Resource Usage:${NC}"
    
    # Get container stats (one-time)
    STATS=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" $CONTAINER_NAME)
    echo "$STATS"
    
    # Parse CPU and memory usage
    CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" $CONTAINER_NAME | sed 's/%//')
    MEM_USAGE=$(docker stats --no-stream --format "{{.MemUsage}}" $CONTAINER_NAME | awk '{print $1}' | sed 's/MiB//')
    
    # Check if usage exceeds limits
    if (( $(echo "$CPU_USAGE > $MAX_CPU_PERCENT" | bc -l) )); then
        echo -e "${RED}⚠ WARNING: CPU usage (${CPU_USAGE}%) exceeds limit (${MAX_CPU_PERCENT}%)${NC}"
    fi
    
    if (( $(echo "$MEM_USAGE > $MAX_MEMORY_MB" | bc -l) )); then
        echo -e "${RED}⚠ WARNING: Memory usage (${MEM_USAGE}MB) exceeds limit (${MAX_MEMORY_MB}MB)${NC}"
    fi
}

# Function to show logs
show_logs() {
    echo -e "\n${YELLOW}Recent logs (last 50 lines):${NC}"
    docker logs --tail 50 $CONTAINER_NAME
}

# Function to monitor continuously
monitor_continuous() {
    echo -e "\n${YELLOW}Starting continuous monitoring (Ctrl+C to stop)...${NC}\n"
    
    while true; do
        clear
        echo -e "${GREEN}=== YBB Admin Dashboard - Live Monitoring ===${NC}"
        echo -e "Time: $(date '+%Y-%m-%d %H:%M:%S')\n"
        
        show_resource_usage
        
        echo -e "\n${YELLOW}Press Ctrl+C to stop monitoring${NC}"
        sleep 5
    done
}

# Main menu
show_menu() {
    echo -e "\n${YELLOW}What would you like to do?${NC}"
    echo "1) Deploy/Redeploy admin dashboard"
    echo "2) Check current status and resource usage"
    echo "3) View logs"
    echo "4) Monitor continuously"
    echo "5) Restart container"
    echo "6) Stop container"
    echo "7) Exit"
    echo -n "Enter choice [1-7]: "
}

# Main script
check_docker

if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
        show_menu
        read choice
        
        case $choice in
            1)
                cleanup_old_container
                pull_images
                rebuild_and_restart
                check_health
                ;;
            2)
                check_health
                ;;
            3)
                show_logs
                ;;
            4)
                monitor_continuous
                ;;
            5)
                echo -e "\n${YELLOW}Restarting container...${NC}"
                docker restart $CONTAINER_NAME
                check_health
                ;;
            6)
                echo -e "\n${YELLOW}Stopping container...${NC}"
                docker stop $CONTAINER_NAME
                echo -e "${GREEN}✓ Container stopped${NC}"
                ;;
            7)
                echo -e "\n${GREEN}Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid choice${NC}"
                ;;
        esac
    done
else
    # Command line mode
    case "$1" in
        deploy)
            cleanup_old_container
            pull_images
            rebuild_and_restart
            check_health
            ;;
        status)
            check_health
            ;;
        logs)
            show_logs
            ;;
        monitor)
            monitor_continuous
            ;;
        restart)
            docker restart $CONTAINER_NAME
            check_health
            ;;
        stop)
            docker stop $CONTAINER_NAME
            ;;
        *)
            echo "Usage: $0 {deploy|status|logs|monitor|restart|stop}"
            exit 1
            ;;
    esac
fi
