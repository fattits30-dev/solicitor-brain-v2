#!/bin/bash
echo "Opening browser to http://localhost:5173"
xdg-open http://localhost:5173 2>/dev/null || open http://localhost:5173 2>/dev/null || echo "Please open http://localhost:5173 in your browser"