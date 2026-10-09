# Kubernetes Microservices Monitoring

A queue-based Node.js microservices system that processes CPU-intensive jobs, auto-scales workers with Kubernetes HPA, and is monitored with Prometheus and Grafana.

| Service   | Role                                                                 | Port |
| --------- | -------------------------------------------------------------------- | ---- |
| Service A | Job Submitter API, pushes jobs to Redis                              | 3000 |
| Service B | Worker, consumes jobs and runs CPU-heavy tasks (horizontally scaled) | 3001 |
| Service C | Stats aggregator, exposes job counts and queue length                | 3002 |
| Redis     | Job queue, job records and counters                                  | 6379 |

## Tech Stack

Node.js, Express, Redis, prom-client, Docker, Kubernetes (Minikube), Helm, Prometheus, Grafana, Apache Bench

## Project Structure

```
k8s-microservices-monitoring/
├── services/
│   ├── service-a/        # Job Submitter API
│   ├── service-b/        # Worker + Prometheus metrics
│   └── service-c/        # Stats + Prometheus metrics
├── k8s/                  # Kubernetes manifests
├── monitoring/           # ServiceMonitors and Grafana dashboard
├── load-test/            # Stress test files
├── docs/                 # Diagrams and screenshots
└── docker-compose.yml    # Local Redis
```

## API Endpoints

### Service A – Job Submitter

| Method | Endpoint      | Description                                                                                                     |
| ------ | ------------- | --------------------------------------------------------------------------------------------------------------- |
| POST   | `/submit`     | Submit a job. Body: `{ "taskType": "primes" \| "bcrypt" \| "sort" }`. If omitted, a random task type is picked. |
| GET    | `/status/:id` | Get job status and result                                                                                       |
| GET    | `/health`     | Liveness check                                                                                                  |
| GET    | `/ready`      | Readiness check (Redis connectivity)                                                                            |

### Service B – Worker

| Method | Endpoint   | Description        |
| ------ | ---------- | ------------------ |
| GET    | `/metrics` | Prometheus metrics |
| GET    | `/health`  | Liveness check     |
| GET    | `/ready`   | Readiness check    |

CPU-intensive tasks:

- `primes` – count primes up to 100,000
- `bcrypt` – bcrypt hashing with 10 salt rounds
- `sort` – generate and sort 100,000 random integers

### Service C – Stats

| Method | Endpoint   | Description                                          |
| ------ | ---------- | ---------------------------------------------------- |
| GET    | `/stats`   | Job counts, average processing time and queue length |
| GET    | `/metrics` | Prometheus metrics                                   |
| GET    | `/health`  | Liveness check                                       |
| GET    | `/ready`   | Readiness check                                      |

## Job Flow

1. Service A creates a job record and pushes the job ID to the Redis queue in a single transaction.
2. Service B waits on the queue with `BRPOP`, picks up the job, and marks it `processing`.
3. Service B runs the task, saves the result, marks it `completed` (or `failed`), and updates counters.
4. Service C reads the counters and queue length from Redis in a single call.

Job status lifecycle: `queued → processing → completed / failed`

## Redis Data Model

| Key                           | Type   | Description                                                 |
| ----------------------------- | ------ | ----------------------------------------------------------- |
| `jobs:queue`                  | List   | Job IDs waiting to be processed (FIFO)                      |
| `job:<id>`                    | Hash   | Job details: taskType, status, result, timestamps, duration |
| `stats:submitted`             | String | Total jobs submitted                                        |
| `stats:completed`             | String | Total jobs completed                                        |
| `stats:failed`                | String | Total jobs failed                                           |
| `stats:total_processing_time` | String | Sum of processing time (seconds)                            |

## Prometheus Metrics

| Service | Metric                                   | Type      |
| ------- | ---------------------------------------- | --------- |
| B       | `jobs_processed_total{task_type}`        | Counter   |
| B       | `job_processing_time_seconds{task_type}` | Histogram |
| B       | `job_errors_total{task_type}`            | Counter   |
| C       | `total_jobs_submitted`                   | Gauge     |
| C       | `total_jobs_completed`                   | Gauge     |
| C       | `total_jobs_failed`                      | Gauge     |
| C       | `queue_length`                           | Gauge     |
| C       | `avg_job_processing_time_seconds`        | Gauge     |

## Run Locally

Prerequisites: Node.js 18+, Docker

```bash
# Start Redis
docker compose up -d redis

# Start each service in a separate terminal
cd services/service-a && npm install && npm run dev
cd services/service-b && npm install && npm run dev
cd services/service-c && npm install && npm run dev
```

## High Level Diagram

<img width="791" height="526" alt="Screenshot 2026-10-05 at 7 43 15 PM" src="https://github.com/user-attachments/assets/f6f1a2b2-9a4b-46e1-8109-f52f2769dece" />
