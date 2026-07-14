#!/bin/bash
# Afdian Tools - Linux launcher

check_node() {
    if ! command -v node &> /dev/null; then
        echo "[ERROR] Node.js not found. Please install Node.js 18+"
        exit 1
    fi
}

install_deps() {
    if [ ! -d "node_modules" ]; then
        echo "[INFO] Installing dependencies..."
        npm install
    fi
}

check_config() {
    if [ ! -f "config.json" ]; then
        echo "[HINT] config.json not found."
        echo "       Copy config.example.json to config.json"
        echo ""
    fi
}

check_node
install_deps
check_config

case "${1:-}" in
    check)
        if [ -z "${2:-}" ]; then
            echo "Usage: ./start.sh check <ORDER_NO>"
            exit 1
        fi
        node src/cli.js "$2" -c config.json
        ;;
    bot)
        if [ -z "${2:-}" ]; then
            echo "Usage: ./start.sh bot <GROUP_ID>"
            exit 1
        fi
        node src/bot.js "$2"
        ;;
    help|-h|--help)
        echo "================================"
        echo "       Afdian Tools"
        echo "================================"
        echo ""
        echo "  Usage:"
        echo "    ./start.sh                 Menu"
        echo "    ./start.sh check <order>   Check order"
        echo "    ./start.sh bot <group>     Start QQ bot"
        echo "    ./start.sh help            Help"
        echo ""
        echo "  1. Copy config.example.json -> config.json"
        echo "  2. Fill in ifdian user_id and token"
        echo "     (https://afdian.net/dashboard/dev)"
        echo "  3. Bot requires NapCat with WebSocket"
        echo "     (See README.md)"
        ;;
    "")
        while true; do
            clear 2>/dev/null || true
            echo "================================"
            echo "       Afdian Tools"
            echo "================================"
            echo ""
            echo "  1 - Check Order"
            echo "  2 - Start QQ Bot"
            echo "  3 - Help"
            echo "  0 - Exit"
            echo ""
            read -p " Choice (0/1/2/3): " opt
            case "$opt" in
                1)
                    read -p " Order number: " order_no
                    echo "------------------------------------"
                    node src/cli.js "$order_no" -c config.json
                    echo "------------------------------------"
                    read -p "Press Enter to continue..."
                    ;;
                2)
                    echo ""
                    echo "  Note: Bot runs continuously."
                    echo "  Press Ctrl+C to stop."
                    echo ""
                    read -p " Group number: " group_id
                    echo "------------------------------------"
                    echo "Starting bot, press Ctrl+C to stop..."
                    echo "------------------------------------"
                    node src/bot.js "$group_id"
                    read -p "Press Enter to continue..."
                    ;;
                3)
                    clear 2>/dev/null || true
                    echo "================================"
                    echo "    Afdian Tools - Help"
                    echo "================================"
                    echo ""
                    echo "  Usage:"
                    echo "    ./start.sh               Menu"
                    echo "    ./start.sh check <order>  Check order"
                    echo "    ./start.sh bot <group>    Start QQ bot"
                    echo "    ./start.sh help           Help"
                    echo ""
                    echo "  1. Copy config.example.json -> config.json"
                    echo "  2. Fill in ifdian user_id and token"
                    echo "     (https://afdian.net/dashboard/dev)"
                    echo "  3. Bot requires NapCat with WebSocket"
                    echo "     (See README.md)"
                    echo ""
                    read -p "Press Enter to continue..."
                    ;;
                0)
                    exit 0
                    ;;
                *)
                    echo "Invalid input"
                    sleep 1
                    ;;
            esac
        done
        ;;
    *)
        echo "[ERROR] Unknown argument: $1"
        echo "Usage: ./start.sh help"
        exit 1
        ;;
esac