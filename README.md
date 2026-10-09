# Kubernetes Microservices Monitoring

A queue-based Node.js + TypeScript microservices system that processes CPU-intensive jobs, autoscales its workers with Kubernetes HPA, and is monitored with Prometheus and Grafana.

<img width="791" alt="Architecture" src="https://github.com/user-attachments/assets/f6f1a2b2-9a4b-46e1-8109-f52f2769dece" />

| Component | Role | Port | Kubernetes Service |
| --- | --- | --- | --- |
| Service A | Job Submitter API: accepts jobs and returns job status | 3000 | LoadBalancer (8080) + Ingress |
| Service B | Worker: consumes jobs and runs CPU-intensive tasks (autoscaled) | 3001 | ClusterIP |
| Service C | Stats aggregator: job counts, average time, queue length | 3002 | ClusterIP |
| Redis | Job queue, job records and counters (with persistent volume) | 6379 | ClusterIP |
| Prometheus | Scrapes `/metrics` from Service B and C every 15s | 9090 | ClusterIP (Helm) |
| Grafana | Dashboards built on Prometheus data | 80 | ClusterIP (Helm) |

## Tech Stack

| Area | Tools |
| --- | --- |
| Services | Node.js 22, TypeScript, Express, node-redis, prom-client, bcryptjs |
| Queue and storage | Redis 7 (append-only persistence) |
| Code quality | ESLint (type-aware rules), Prettier, Jest, Supertest |
| Containers | Docker (multi-stage builds), Docker Compose |
| Orchestration | Kubernetes on Minikube, NGINX Ingress, HPA, metrics-server |
| Monitoring | Prometheus and Grafana (`kube-prometheus-stack` Helm chart) |
| Load testing | Apache Bench (`ab`) |

## Project Structure

```
k8s-microservices-monitoring/
├── services/
│   ├── service-a/                 # Job Submitter API
│   │   ├── src/
│   │   │   ├── app.ts             # Express routes (/submit, /status, /health, /ready)
│   │   │   ├── config.ts          # Port, Redis URL, task types, Redis keys
│   │   │   ├── redis.ts           # Redis client
│   │   │   └── index.ts           # Server start + graceful shutdown
│   │   ├── tests/app.test.ts
│   │   ├── Dockerfile
│   │   ├── tsconfig.json / tsconfig.build.json / jest.config.js
│   │   └── package.json
│   ├── service-b/                 # Worker
│   │   ├── src/
│   │   │   ├── tasks.ts           # CPU tasks: primes, bcrypt, sort
│   │   │   ├── worker.ts          # BRPOP loop + job processing
│   │   │   ├── metrics.ts         # Prometheus metrics
│   │   │   ├── app.ts             # /metrics, /health, /ready
│   │   │   ├── config.ts / redis.ts / index.ts
│   │   └── tests/                 # tasks, worker and app tests
│   └── service-c/                 # Stats aggregator
│       ├── src/
│       │   ├── stats.ts           # Reads all counters in one Redis call
│       │   ├── metrics.ts         # Prometheus gauges
│       │   ├── app.ts             # /stats, /metrics, /health, /ready
│       │   ├── config.ts / redis.ts / index.ts
│       └── tests/                 # stats and app tests
├── k8s/
│   ├── namespace/                 # Namespace + ConfigMap
│   ├── redis/                     # PVC, Deployment, Service
│   ├── service-a/                 # Deployment + LoadBalancer Service
│   ├── service-b/                 # Deployment + Service + HPA
│   ├── service-c/                 # Deployment + Service
│   └── ingress/                   # NGINX Ingress rules
├── monitoring/
│   ├── prometheus-values.yaml     # Helm values for Prometheus + Grafana
│   ├── service-b-servicemonitor.yaml
│   ├── service-c-servicemonitor.yaml
│   ├── grafana-dashboard.json
│   └── grafana-dashboard-configmap.yaml
├── load-test/
│   ├── body.json                  # POST body for Apache Bench
│   └── ab-results.txt             # Stress test output
├── docs/                          # Architecture diagram and screenshots
├── eslint.config.mjs              # Shared ESLint config (all services)
├── .prettierrc / .prettierignore  # Shared Prettier config
├── docker-compose.yml             # Local run: Redis + all services
└── package.json                   # Root scripts: lint, format, test, typecheck
```

## Services and Endpoints

### Service A – Job Submitter

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/submit` | Submit a job. Body: `{ "taskType": "primes" \| "bcrypt" \| "sort" }`. If omitted, a random task type is picked. Returns `202` with `jobId`. Invalid type returns `400`. |
| GET | `/status/:id` | Job status, result and duration. Returns `404` if not found. |
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness check (Redis reachable) |

### Service B – Worker

Runs one of three CPU-intensive tasks per job:

| Task | Work |
| --- | --- |
| `primes` | Count prime numbers up to 100,000 |
| `bcrypt` | bcrypt hash with 10 salt rounds |
| `sort` | Generate and sort 100,000 random integers |

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/metrics` | Prometheus metrics |
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness check |

### Service C – Stats

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/stats` | Submitted, completed and failed counts, queue length, average processing time |
| GET | `/metrics` | Prometheus metrics |
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness check |

## Job Flow and Redis Data Model

1. Service A saves the job record, pushes its ID to the queue and increments the submitted counter in one Redis transaction (`MULTI`).
2. A Service B pod waits on the queue with `BRPOP`, takes the job and marks it `processing`.
3. Service B runs the task, saves the result, marks it `completed` (or `failed`) and updates the counters and its Prometheus metrics.
4. Service C reads all counters and the queue length in a single Redis call.

Job status: `queued → processing → completed / failed`

| Key | Type | Written by | Description |
| --- | --- | --- | --- |
| `jobs:queue` | List | A (`LPUSH`), B (`BRPOP`) | Job IDs waiting to be processed (FIFO) |
| `job:<id>` | Hash | A, B | taskType, status, result, timestamps, duration |
| `stats:submitted` | String | A | Total jobs submitted |
| `stats:completed` | String | B | Total jobs completed |
| `stats:failed` | String | B | Total jobs failed |
| `stats:total_processing_time` | String | B | Sum of processing time in seconds |

## Prometheus Metrics

| Service | Metric | Type | Labels |
| --- | --- | --- | --- |
| B | `jobs_processed_total` | Counter | `task_type` |
| B | `job_processing_time_seconds` | Histogram | `task_type` |
| B | `job_errors_total` | Counter | `task_type` |
| C | `total_jobs_submitted` | Gauge | |
| C | `total_jobs_completed` | Gauge | |
| C | `total_jobs_failed` | Gauge | |
| C | `queue_length` | Gauge | |
| C | `avg_job_processing_time_seconds` | Gauge | |

Both services also expose default Node.js metrics (CPU, memory, event loop lag).

## Code Quality: TypeScript, ESLint, Prettier and Tests

All services are written in TypeScript with `strict` mode. From the repo root:

```bash
npm install                       # root tools (ESLint, Prettier)
npm install --prefix services/service-a
npm install --prefix services/service-b
npm install --prefix services/service-c

npm run lint                      # ESLint, all services
npm run format:check              # Prettier check
npm run typecheck                 # TypeScript, all services
npm test                          # Jest, all services
```

**ESLint** uses `typescript-eslint` with type-aware rules, including `no-unsafe-*`, `no-floating-promises`, `no-misused-promises`, `await-thenable`, `no-explicit-any`, `consistent-type-imports` and `eqeqeq`. In test files, the `no-unsafe-*` rules are relaxed because Jest mocks and Supertest responses are untyped.

**Tests** run without a real Redis; the Redis client is mocked.

| Service | Tests | What is covered |
| --- | --- | --- |
| A | 9 | Submit (valid, random type, invalid type, Redis failure), status (found, not found), health and readiness |
| B | 11 | CPU task results (25 primes up to 100, 9,592 up to 100,000, sort, bcrypt 10 rounds), worker success, failure and missing job, metrics endpoint |
| C | 7 | Stats calculation, zero state, single Redis call, `/stats`, `/metrics` values, readiness |

## Run Locally with Docker Compose

```bash
docker compose up --build -d
docker compose ps                 # all containers should be healthy

curl -X POST http://localhost:3000/submit -H "Content-Type: application/json" -d '{"taskType":"primes"}'
curl http://localhost:3000/status/<jobId>
curl http://localhost:3002/stats
curl http://localhost:3001/metrics

docker compose down
```

## Deploy on Minikube

### 1. Start the cluster

```bash
minikube start --driver=docker --cpus=4 --memory=5120
minikube addons enable ingress
minikube addons enable metrics-server
```

### 2. Build and load images

The cluster uses the containerd runtime, so images are built with Docker on the host and loaded into Minikube.

```bash
docker build -t service-a:1.2 ./services/service-a
docker build -t service-b:1.2 ./services/service-b
docker build -t service-c:1.2 ./services/service-c

minikube image load service-a:1.2
minikube image load service-b:1.2
minikube image load service-c:1.2
```

### 3. Apply manifests (order matters)

```bash
kubectl apply -f k8s/namespace/namespace.yaml
kubectl apply -f k8s/namespace/configmap.yaml
kubectl apply -f k8s/redis/
kubectl wait --for=condition=ready pod -l app=redis -n monitoring-app --timeout=120s
kubectl apply -f k8s/service-a/ -f k8s/service-b/ -f k8s/service-c/
kubectl apply -f k8s/ingress/
```

### 4. Expose the services

In a separate terminal (keep it open; it asks for your password):

```bash
minikube tunnel
```

### 5. Verify

```bash
kubectl get pods -n monitoring-app
kubectl get svc -n monitoring-app       # service-a-svc EXTERNAL-IP: 127.0.0.1
kubectl get ingress -n monitoring-app
kubectl get hpa -n monitoring-app       # TARGETS shows cpu: x%/70%, not <unknown>

# Through NGINX Ingress
curl -X POST http://127.0.0.1/submit -H "Content-Type: application/json" -d '{"taskType":"primes"}'
curl http://127.0.0.1/status/<jobId>

# Through the LoadBalancer directly
curl -X POST http://127.0.0.1:8080/submit -H "Content-Type: application/json" -d '{"taskType":"sort"}'

# Service C is internal; use port-forward
kubectl port-forward svc/service-c-svc 3002:3002 -n monitoring-app
curl http://localhost:3002/stats
```

### 3. Open the UIs

```bash
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring
```

- **Grafana:** http://localhost:3000, user `admin`, password `admin123`. Dashboard: **Job Processing & Autoscaling**.
- **Prometheus targets:** http://localhost:9090/targets. `service-b-monitor` should show 2/2 up and `service-c-monitor` 1/1 up.

### Results

Run on Minikube (Docker driver, 4 CPUs) with Service B starting at 2 pods. Raw data: `load-test/ab-results.txt` and `load-test/scaling-log.txt`.

**Apache Bench**

| Metric | Value |
| --- | --- |
| Total requests | 5000 |
| Concurrency | 200 |
| Time taken | 14.14 s |
| Requests per second | 353.5 |
| Median response time | 201 ms |
| 95th percentile | 2540 ms |
| Longest request | 7588 ms |
| Connect / receive / exception errors | 0 |
| "Failed requests" reported by ab | 3336, all `Length` mismatches (see note) |

**Autoscaling timeline** (t = 0 at 19:28:03, when the load started)

| Time | Queue | Ready pods | Event |
| --- | --- | --- | --- |
| t+0s | 0 | 2 | Load test starts |
| t+16s | 4772 | 2 | Peak queue length; `ab` finishes |
| t+1m50s | 3001 | 5 | First scale-up (2 → 5) |
| t+2m31s | 2694 | 7 | Scaling continues |
| t+3m53s | 2067 | 10 | Maximum of 10 pods reached |
| t+6m26s | 0 | 10 | Queue fully drained |
| t+8m35s | 0 | 10 | CPU drops below target (16%) |
| t+10m18s | 0 | 5 | Scale-down 10 → 5 |
| t+11m17s | 0 | 3 | Scale-down 5 → 3 |
| t+12m21s | 0 | 2 | Back to minimum of 2 pods |

| Metric | Value |
| --- | --- |
| Peak queue length | 4772 jobs |
| Worker pods (start → peak) | 2 → 10 |
| Time to first scale-up | ~1 min 50 s |
| Time to reach 10 pods | ~3 min 53 s |
| Time for queue to drain | ~6 min 26 s |
| Time to scale back to 2 pods | ~6 min after the queue drained |

## Troubleshooting

| Problem | Fix |
| --- | --- |
| HPA shows `<unknown>` | Enable metrics-server (`minikube addons enable metrics-server`) and wait 1–2 minutes; check `resources.requests.cpu` is set |
| `curl http://127.0.0.1/...` returns `405` or a different app | Another process uses port 80. Check with `sudo lsof -nP -iTCP:80 -sTCP:LISTEN`, stop it, then restart `minikube tunnel` |
| `EXTERNAL-IP` is `<pending>` | `minikube tunnel` is not running |
| `ErrImageNeverPull` | Image not loaded: run `minikube image load <image>:<tag>` |
| `docker-env` build fails with containerd | Build on the host and use `minikube image load` instead |
| Prometheus target missing | Check `kubectl get servicemonitor -n monitoring` and that the Service has a port named `http` |

## Cleanup

```bash
kubectl delete namespace monitoring-app
helm uninstall prometheus -n monitoring
kubectl delete namespace monitoring
minikube stop
```

## Screenshot
<img width="1086" height="526" alt="Screenshot 2026-10-09 at 8 12 38 PM" src="https://github.com/user-attachments/assets/6903a45f-e601-4a9a-a05c-c5c2032a312d" />
<img width="1086" height="526" alt="Screenshot 2026-10-09 at 8 13 06 PM" src="https://github.com/user-attachments/assets/d152c4f6-5019-4aa3-b565-d94e6d1b078b" />


