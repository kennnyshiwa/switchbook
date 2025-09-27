# SwitchesDB Docker Image
FROM clojure:temurin-21-alpine

# Install required tools
RUN apk add --no-cache \
    git \
    make \
    bash \
    curl \
    nginx \
    python3 \
    py3-pip

# Install Babashka
RUN curl -sLO https://raw.githubusercontent.com/babashka/babashka/master/install && \
    chmod +x install && \
    ./install && \
    rm install

WORKDIR /app

# Clone SwitchesDB repository
RUN git clone https://github.com/heralden/switchesdb.git .

# Initialize git submodules (ThereminGoat and OSCM data)
# Handle large repos with increased timeouts
RUN git config --global http.postBuffer 524288000 && \
    git config --global http.lowSpeedLimit 0 && \
    git config --global http.lowSpeedTime 999999 && \
    echo "Initializing submodules (this will take several minutes)..." && \
    git submodule update --init --remote --progress || true \
    git submodule update --remote

# Run initial data preparation
RUN echo "Scraping HaaTa data (this may take a while)..." && \
    bb haata || echo "HaaTa scraping completed or skipped"

# Patch charts.cljs to remove force limit (make it unlimited)
RUN sed -i 's/:range \[0 120\]/:range [0 250]/' src/switchesdb/charts.cljs

# Add resizable side panel functionality
RUN sed -i '/\.side-panel {/,/^}/{ s/z-index: 1;/z-index: 1;\n    resize: horizontal;\n    overflow: auto;\n    min-width: 15em;\n    max-width: 40em;/ }' resources/public/styles.css

# Prepare and build the static files
RUN make prepare && \
    make update && \
    make build

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create script to update force curve data
COPY update-force-curves.sh /usr/local/bin/update-force-curves
RUN chmod +x /usr/local/bin/update-force-curves

# Expose port
EXPOSE 80

# Start nginx to serve the static files
CMD ["nginx", "-g", "daemon off;"]