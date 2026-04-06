FROM golang:1.22 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
{{BUILD_COMMAND}}

FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server /app/server
EXPOSE {{PORT}}
CMD {{START_COMMAND}}
