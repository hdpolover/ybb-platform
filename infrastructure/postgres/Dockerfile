FROM postgres:16-alpine

# Copy initialization scripts
COPY init/*.sql /docker-entrypoint-initdb.d/

# Set timezone
ENV TZ=UTC

EXPOSE 5432
