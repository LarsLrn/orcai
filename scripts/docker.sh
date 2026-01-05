#!/bin/bash

# Sokratest Docker Management Script
# Usage: ./scripts/docker.sh [command]

set -e

COMPOSE_FILE="docker-compose.yml"
OVERRIDE_FILE="docker-compose.override.yml"
ENV_FILE=".env.docker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Check if environment file exists
check_env() {
    if [ -f ".env.docker.local" ]; then
        ENV_FILE=".env.docker.local"
        log "Using .env.docker.local for environment configuration"
    elif [ -f ".env.docker" ]; then
        ENV_FILE=".env.docker"
        log "Using .env.docker for environment configuration"
    else
        warn "No environment file found."
        log "Creating .env.docker.local from template..."
        cp .env.docker .env.docker.local
        warn "Please edit .env.docker.local with your configuration before starting services."
        ENV_FILE=".env.docker.local"
    fi
}

# Commands
dev() {
    log "Starting development environment..."
    check_docker
    check_env
    docker-compose --env-file="$ENV_FILE" up -d
    log "Services started. Access your app at http://localhost:3000"
    log "MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
    log "Qdrant Dashboard: http://localhost:6333/dashboard"
}

prod() {
    log "Starting production environment..."
    check_docker
    check_env
    docker-compose --env-file="$ENV_FILE" -f "$COMPOSE_FILE" up -d
    log "Production services started."
}

stop() {
    log "Stopping all services..."
    docker-compose down
    log "All services stopped."
}

logs() {
    if [ -n "$1" ]; then
        docker-compose logs -f "$1"
    else
        docker-compose logs -f
    fi
}

status() {
    log "Service status:"
    docker-compose ps
}

clean() {
    warn "This will remove all containers and volumes (ALL DATA WILL BE LOST!)"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Cleaning up..."
        docker-compose down -v --remove-orphans
        docker system prune -f
        log "Cleanup complete."
    else
        log "Cleanup cancelled."
    fi
}

rebuild() {
    log "Rebuilding application container..."
    docker-compose build --no-cache sokratest
    log "Rebuild complete. Restart with './scripts/docker.sh dev' or './scripts/docker.sh prod'"
}

migrate() {
    log "Running database migrations..."
    docker-compose exec sokratest bun run db:migrate
    log "Migrations complete."
}

seed() {
    log "Seeding database..."
    docker-compose exec sokratest bun run db:seed
    log "Database seeded."
}

shell() {
    service=${1:-sokratest}
    log "Opening shell in $service container..."
    docker-compose exec "$service" sh
}

# Main command handling
case "$1" in
    "dev"|"development")
        dev
        ;;
    "prod"|"production")
        prod
        ;;
    "stop")
        stop
        ;;
    "logs")
        logs "$2"
        ;;
    "status"|"ps")
        status
        ;;
    "clean")
        clean
        ;;
    "rebuild")
        rebuild
        ;;
    "migrate")
        migrate
        ;;
    "seed")
        seed
        ;;
    "shell")
        shell "$2"
        ;;
    "help"|"-h"|"--help"|"")
        echo "Sokratest Docker Management Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  dev, development    Start development environment"
        echo "  prod, production    Start production environment"
        echo "  stop                Stop all services"
        echo "  logs [service]      Show logs (optionally for specific service)"
        echo "  status, ps          Show service status"
        echo "  clean               Remove all containers and volumes (destructive!)"
        echo "  rebuild             Rebuild application container"
        echo "  migrate             Run database migrations"
        echo "  seed                Seed database with initial data"
        echo "  shell [service]     Open shell in container (default: sokratest)"
        echo "  help                Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 dev              # Start development environment"
        echo "  $0 logs postgres    # Show PostgreSQL logs"
        echo "  $0 shell postgres   # Open shell in PostgreSQL container"
        ;;
    *)
        error "Unknown command: $1"
        echo "Use '$0 help' for usage information."
        exit 1
        ;;
esac
