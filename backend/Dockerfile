# syntax=docker/dockerfile:1.7
# Multi-stage build for the LexiForge backend.
#
# Stage 1 compiles a fully static binary (CGO disabled) so the runner image
# can be a tiny alpine without libc surprises.

FROM golang:1.26-alpine AS builder
WORKDIR /src

# Cache module downloads — go.mod / go.sum invalidate this layer only when
# dependencies actually change.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .

ARG TARGETOS=linux
ARG TARGETARCH=amd64
ENV CGO_ENABLED=0
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.24 AS runner
RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder --chown=app:app /out/server /app/server
USER app
EXPOSE 8080
ENTRYPOINT ["/app/server"]
