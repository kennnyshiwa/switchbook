# SwitchesDB Docker Image
FROM clojure:temurin-21-alpine

# Install required tools
RUN apk add --no-cache \
    git \
    make \
    bash \
    curl \
    nginx

# Install Babashka
RUN curl -sLO https://raw.githubusercontent.com/babashka/babashka/master/install && \
    chmod +x install && \
    ./install && \
    rm install

WORKDIR /app

# Clone SwitchesDB repository (from fork with permanent patches)
RUN git clone https://github.com/kennnyshiwa/switchesdb.git .

# Initialize git submodules (ThereminGoat, OSCM, and BuddyOG data)
# Handle large repos with increased timeouts
RUN git config --global http.postBuffer 524288000 && \
    git config --global http.lowSpeedLimit 0 && \
    git config --global http.lowSpeedTime 999999 && \
    echo "Initializing submodules (this will take several minutes)..." && \
    git submodule update --init --remote --progress || true \
    git submodule update --remote

# NOTE: HaaTa data is now pre-cached in the repository (resources/haata)
# Plotly deprecated chart-studio.plotly.com so scraping no longer works
# The haata files were backed up and committed to the fork

# NOTE: Patches are now permanent in the fork (kennnyshiwa/switchesdb):
# - Force range extended to 0-250 (in src/switchesdb/charts.cljs)
# - Chart dimensions set to 1000x500 (in src/switchesdb/charts.cljs)
# - Resizable side panel CSS (in resources/public/styles.css)

# Parse all data sources (ThereminGoat, Haata, BluePylons, BuddyOG) and build
# The native Clojure parser handles all sources including BuddyOG
RUN make prepare && \
    make update

# Build the static files
RUN make build

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create script to update force curve data
COPY update-force-curves.sh /usr/local/bin/update-force-curves
RUN chmod +x /usr/local/bin/update-force-curves

# Expose port
EXPOSE 80

# Start nginx to serve the static files
CMD ["nginx", "-g", "daemon off;"]