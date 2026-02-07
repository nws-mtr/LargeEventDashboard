#!/bin/bash
# Setup script for Large Event Dashboard

echo "🚀 Setting up Large Event Dashboard..."
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment and install dependencies
echo "📚 Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

if [ $? -eq 0 ]; then
    echo "✅ Python dependencies installed"
else
    echo "❌ Failed to install Python dependencies"
    exit 1
fi

# Install Node.js dependencies
if [ -f "package.json" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
    
    if [ $? -eq 0 ]; then
        echo "✅ Node.js dependencies installed"
    else
        echo "❌ Failed to install Node.js dependencies"
        exit 1
    fi
fi

# Create data directories if they don't exist
echo "📁 Creating data directories..."
mkdir -p data/mrms
mkdir -p data/satellite
mkdir -p data/grib
mkdir -p data/cache

echo "✅ Data directories ready"

# Check if config exists
if [ ! -f "config/event.config.json" ]; then
    echo "⚠️  Warning: config/event.config.json not found"
    echo "   Please create this file before running the server"
else
    echo "✅ Configuration file found"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Review config/event.config.json"
echo "   2. Run: npm start"
echo "   3. Open: http://localhost:3000"
echo ""
