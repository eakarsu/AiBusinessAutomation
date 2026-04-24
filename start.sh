#!/bin/bash

# AI Business Automation - Startup Script with Auto-Reload
# This script sets up and runs the complete application with file watching

set -e

echo "=========================================="
echo "  AI Business Automation Platform"
echo "  Starting Application with Auto-Reload..."
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=5001
FRONTEND_PORT=3000
DB_NAME="ai_business_automation"
DB_USER="postgres"
DB_PASSWORD="postgres"

# Function to print colored messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to clean up ports
cleanup_ports() {
    print_status "Cleaning up ports $BACKEND_PORT and $FRONTEND_PORT..."

    # Kill processes on backend port
    if lsof -ti:$BACKEND_PORT > /dev/null 2>&1; then
        print_warning "Killing process on port $BACKEND_PORT"
        lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    fi

    # Kill processes on frontend port
    if lsof -ti:$FRONTEND_PORT > /dev/null 2>&1; then
        print_warning "Killing process on port $FRONTEND_PORT"
        lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    fi

    print_success "Ports cleaned up"
    sleep 2
}

# Function to check if PostgreSQL is running
check_postgres() {
    print_status "Checking PostgreSQL connection..."

    if command -v pg_isready &> /dev/null; then
        if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
            print_success "PostgreSQL is running"
            return 0
        fi
    fi

    # Try to connect using psql
    if PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -c '\q' 2>/dev/null; then
        print_success "PostgreSQL is running"
        return 0
    fi

    print_warning "PostgreSQL doesn't seem to be running."
    print_status "Attempting to start PostgreSQL..."

    # Try to start PostgreSQL based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo service postgresql start 2>/dev/null || sudo systemctl start postgresql 2>/dev/null || true
    fi

    sleep 3

    # Check again
    if PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -c '\q' 2>/dev/null; then
        print_success "PostgreSQL started successfully"
        return 0
    else
        print_error "Could not connect to PostgreSQL. Please ensure PostgreSQL is installed and running."
        print_status "You can start PostgreSQL manually and run this script again."
        return 1
    fi
}

# Function to setup database
setup_database() {
    print_status "Setting up database..."

    # Create database if it doesn't exist
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -c "CREATE DATABASE $DB_NAME" 2>/dev/null || true

    print_success "Database '$DB_NAME' is ready"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing backend dependencies..."
    cd backend
    npm install --silent
    cd ..
    print_success "Backend dependencies installed"

    print_status "Installing frontend dependencies..."
    cd frontend
    npm install --silent
    cd ..
    print_success "Frontend dependencies installed"
}

# Function to seed the database
seed_database() {
    print_status "Seeding database with sample data (15 items per feature)..."
    cd backend
    node src/seed.js
    cd ..
    print_success "Database seeded successfully"
}

# Function to start the backend with nodemon (auto-reload)
start_backend() {
    print_status "Starting backend server on port $BACKEND_PORT with auto-reload..."
    cd backend

    # Check if nodemon is installed, use it for auto-reload
    if npx nodemon --version > /dev/null 2>&1; then
        print_status "Using nodemon for backend auto-reload..."
        npx nodemon --watch src --ext js,json src/index.js &
    else
        print_warning "Nodemon not found, using node with manual restart..."
        node src/index.js &
    fi

    BACKEND_PID=$!
    cd ..
    sleep 3

    # Check if backend is running
    if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
        print_success "Backend server is running (PID: $BACKEND_PID)"
        print_status "Backend auto-reloads on file changes in /backend/src/"
    else
        print_warning "Backend may still be starting..."
    fi
}

# Function to start the frontend with hot reload (built-in React feature)
start_frontend() {
    print_status "Starting frontend server on port $FRONTEND_PORT with hot-reload..."
    cd frontend

    # React scripts has built-in hot reload
    BROWSER=none PORT=$FRONTEND_PORT FAST_REFRESH=true npm start &
    FRONTEND_PID=$!
    cd ..

    print_success "Frontend server starting (PID: $FRONTEND_PID)"
    print_status "Frontend auto-reloads on file changes in /frontend/src/"
}

# Function to display info
display_info() {
    echo ""
    echo "=========================================="
    echo -e "${GREEN}  Application Started Successfully!${NC}"
    echo "=========================================="
    echo ""
    echo -e "  ${BLUE}Frontend:${NC} http://localhost:$FRONTEND_PORT"
    echo -e "  ${BLUE}Backend:${NC}  http://localhost:$BACKEND_PORT"
    echo ""
    echo "  Login Credentials:"
    echo "  -------------------"
    echo -e "  ${YELLOW}Email:${NC}    admin@company.com"
    echo -e "  ${YELLOW}Password:${NC} admin123"
    echo ""
    echo "  (Click 'Auto-fill Demo Credentials' button on login page)"
    echo ""
    echo "=========================================="
    echo -e "  ${GREEN}AUTO-RELOAD ENABLED${NC}"
    echo "=========================================="
    echo ""
    echo -e "  ${BLUE}Backend:${NC}  Watches /backend/src/*.js"
    echo -e "            Auto-restarts on changes (nodemon)"
    echo ""
    echo -e "  ${BLUE}Frontend:${NC} Watches /frontend/src/*"
    echo -e "            Hot-reloads on changes (React Fast Refresh)"
    echo ""
    echo "=========================================="
    echo ""
    echo -e "  Press ${RED}Ctrl+C${NC} to stop all services"
    echo ""
    echo "=========================================="
}

# Cleanup function for exit
cleanup() {
    echo ""
    print_status "Shutting down services..."

    # Kill backend
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi

    # Kill frontend
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi

    # Kill any nodemon processes
    pkill -f "nodemon" 2>/dev/null || true

    # Clean up any remaining processes on ports
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true

    print_success "All services stopped"
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    # Navigate to project root
    cd "$(dirname "$0")"

    # Step 1: Clean up ports
    cleanup_ports

    # Step 2: Check PostgreSQL
    if ! check_postgres; then
        exit 1
    fi

    # Step 3: Setup database
    setup_database

    # Step 4: Install dependencies
    install_dependencies

    # Step 5: Seed database
    seed_database

    # Step 6: Start backend with auto-reload
    start_backend

    # Step 7: Start frontend with hot-reload
    start_frontend

    # Step 8: Display info
    sleep 5
    display_info

    # Wait for processes
    wait
}

# Run main function
main
