# Implantação Kubernetes — Rastreador de Preços

Esta pasta contém os manifestos Kubernetes para orquestrar a aplicação **Rastreador de Preços de GPUs** em um cluster de produção.

## Estrutura dos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `secret.yaml` | Kubernetes Secret com `SUPABASE_URL` e `SUPABASE_KEY` |
| `api-deployment.yaml` | Deployment da API FastAPI (2 réplicas) |
| `api-service.yaml` | Service LoadBalancer para expor a API na porta 80 |
| `scraper-cronjob.yaml` | CronJob diário para execução do scraper (00:00 UTC) |

---

## Pré-requisitos

- Cluster Kubernetes funcionando (EKS, AKS, GKE, Minikube, etc.)
- `kubectl` configurado e autenticado no cluster
- Imagem Docker `rastreador-api:latest` buildada e disponível no registry do cluster

---

## 1. Construir a Imagem Docker

Na raiz do projeto:

```bash
# Build da imagem Docker
docker build -t rastreador-api:latest .

# Se usar registry privado, faça o push:
docker tag rastreador-api:latest <seu-registry>/rastreador-api:latest
docker push <seu-registry>/rastreador-api:latest
```

> **Nota:** O `Dockerfile` na raiz do projeto já está configurado para expor a porta 8000 e rodar o Uvicorn.

---

## 2. Aplicar os Manifestos

Execute os comandos abaixo na ordem indicada:

```bash
# Na pasta k8s/

# 1. Criar os Secrets (variáveis de ambiente sensíveis)
kubectl apply -f secret.yaml

# 2. Criar o Deployment da API
kubectl apply -f api-deployment.yaml

# 3. Criar o Service da API
kubectl apply -f api-service.yaml

# 4. Criar o CronJob do scraper
kubectl apply -f scraper-cronjob.yaml
```

### Verificar a implantação

```bash
# Ver pods da API
kubectl get pods -l app=rastreador-api

# Ver o Service (aguarde o EXTERNAL-IP se for LoadBalancer)
kubectl get svc rastreador-api

# Ver o CronJob
kubectl get cronjob scraper-pichau

# Ver histórico de execuções do scraper
kubectl get jobs -l app=scraper-pichau
```

---

## 3. Testar a API

Após o Service obter um IP externo (LoadBalancer), teste os endpoints:

```bash
# Health check
curl http://<EXTERNAL-IP>/api/health

# Predição
curl -X POST http://<EXTERNAL-IP>/api/predict \
  -H "Content-Type: application/json" \
  -d '{"preco": 2599.90, "media_movel_7d": 2700.00, "variacao_percentual": -5.0}'
```

---

## 4. Executar o Scraper Manualmente (opcional)

Para forçar uma execução imediata do scraper fora do agendamento:

```bash
kubectl create job --from=cronjob/scraper-pichau scraper-manual-$(date +%s)
```

---

## 5. Limpeza (remover todos os recursos)

```bash
kubectl delete -f secret.yaml
kubectl delete -f api-deployment.yaml
kubectl delete -f api-service.yaml
kubectl delete -f scraper-cronjob.yaml
```

---

## Segurança e Boas Práticas

- 🔒 Os segredos do Supabase são injetados via `Secret` do Kubernetes, nunca em texto plano no Deployment.
- 🔄 O Deployment usa `RollingUpdate` para atualizações sem downtime.
- 🏥 Sondas `livenessProbe`, `readinessProbe` e `startupProbe` garantem que a API só receba tráfego quando estiver pronta.
- ⏱️ O CronJob roda diariamente à meia-noite UTC e evita execuções concorrentes (`concurrencyPolicy: Forbid`).
- 📦 Recursos de CPU e memória têm limites definidos para evitar esgotamento do nó.
