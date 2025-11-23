# 🚀 Resume AI Service - 즉시 배포 가이드

## 📋 배포 전 체크리스트

- [x] **GEMINI_API_KEY** 환경변수 설정 확인
- [x] Google Cloud SDK (gcloud) 설치 확인
- [x] Docker 설치 확인
- [x] 프로젝트 ID 확인

---

## ⚡ 빠른 배포 (한 줄 명령어)

### Windows (PowerShell)
```powershell
$env:PROJECT_ID="aijob-abf44"; $env:REGION="asia-northeast3"; cd functions-ocrResume; ./deploy.sh $env:PROJECT_ID $env:REGION
```

### Windows (CMD)
```cmd
cd functions-ocrResume && deploy.sh aijob-abf44 asia-northeast3
```

### Linux/Mac (Bash)
```bash
cd functions-ocrResume && ./deploy.sh aijob-abf44 asia-northeast3
```

---

## 🔧 수동 배포 (단계별)

### 1️⃣ 프로젝트 디렉토리로 이동
```bash
cd functions-ocrResume
```

### 2️⃣ 환경변수 확인
```bash
# Windows PowerShell
echo $env:GEMINI_API_KEY

# Linux/Mac
echo $GEMINI_API_KEY
```

### 3️⃣ Docker 이미지 빌드
```bash
docker build -t gcr.io/aijob-abf44/resume-ai-service .
```

### 4️⃣ Container Registry에 푸시
```bash
docker push gcr.io/aijob-abf44/resume-ai-service
```

### 5️⃣ Cloud Run에 배포
```bash
gcloud run deploy resume-ai-service \
  --image gcr.io/aijob-abf44/resume-ai-service \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=$GEMINI_API_KEY" \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=80 \
  --max-instances=100 \
  --timeout=300
```

---

## 🔍 배포 후 테스트

### Health Check
```bash
curl https://resume-ai-service-123153704050.asia-northeast3.run.app/health
```

**예상 응답:**
```json
{
  "status": "healthy",
  "firebase": "connected",
  "gemini": "connected",
  "timestamp": "2025-11-17T08:41:45.933799"
}
```

### Resume Extract Test
```bash
curl -X POST \
  -F "image=@test-resume.pdf" \
  -F "enhance=true" \
  https://resume-ai-service-123153704050.asia-northeast3.run.app/extract-resume
```

---

## 🐛 트러블슈팅

### 404 오류가 발생하는 경우

1. **Cloud Run 로그 확인**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=resume-ai-service" --limit 50 --format=json
   ```

2. **라우트 등록 확인**
   로그에서 다음과 같은 출력을 찾아보세요:
   ```
   ============================================================
   🔥 Flask 애플리케이션 라우트 등록 확인
   ============================================================
   ✅ /health                                   [GET          ] → health_check
   ✅ /extract-resume                           [POST         ] → extract_resume_api
   ✅ /                                         [POST         ] → root_extract_resume
   ============================================================
   ```

3. **이미지 재빌드 및 재배포**
   ```bash
   # 캐시 없이 재빌드
   docker build --no-cache -t gcr.io/aijob-abf44/resume-ai-service .
   
   # 푸시 및 재배포
   docker push gcr.io/aijob-abf44/resume-ai-service
   gcloud run deploy resume-ai-service --image gcr.io/aijob-abf44/resume-ai-service --region asia-northeast3
   ```

### 환경변수 문제

```bash
# Cloud Run 서비스의 현재 환경변수 확인
gcloud run services describe resume-ai-service --region asia-northeast3 --format="value(spec.template.spec.containers[0].env)"

# 환경변수 업데이트
gcloud run services update resume-ai-service \
  --region asia-northeast3 \
  --set-env-vars="GEMINI_API_KEY=YOUR_API_KEY_HERE"
```

### Worker/스레드 조정

현재 설정: `--workers=2`, `--threads=4`

부하가 높은 경우:
```dockerfile
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "4", \
     "--threads", "8", \
     ...
```

---

## 📊 주요 변경사항 (이번 배포)

### ✅ 수정된 사항:
1. **라우트 등록 로깅 위치 변경**
   - 모든 라우트 정의 **후**에 로깅 실행
   - Gunicorn이 로드할 때 자동으로 라우트 확인

2. **Gunicorn 로그 설정 개선**
   - `--log-level info` 추가
   - `--access-logfile -` (표준 출력)
   - `--error-logfile -` (표준 에러)
   - `--capture-output` (Python print 캡처)

3. **성능 최적화**
   - Workers: 4 → 2 (Cloud Run 권장)
   - Threads: 추가 (4개, CPU 효율적 사용)

### 🎯 해결된 문제:
- ❌ 404 Not Found 오류
- ❌ 라우트가 등록되지 않는 문제
- ❌ 로그가 출력되지 않는 문제

---

## 📞 지원

문제가 지속되는 경우:
1. Cloud Run 로그 전체 복사
2. `curl` 명령어 실행 결과
3. 오류 메시지 스크린샷

이상입니다! 🎉












