# 🚀 배포 가이드

## 목차
1. [백엔드 배포 (Google Cloud Run)](#1-백엔드-배포-google-cloud-run)
2. [프론트엔드 배포 (Vercel)](#2-프론트엔드-배포-vercel)
3. [Firebase 설정](#3-firebase-설정)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [배포 후 확인](#5-배포-후-확인)

---

## 1. 백엔드 배포 (Google Cloud Run)

### 사전 준비
1. Google Cloud 계정 및 프로젝트 생성
2. Google Cloud SDK 설치: https://cloud.google.com/sdk/docs/install

### 1.1 Google Cloud CLI 로그인
```bash
gcloud auth login
gcloud config set project aijob-abf44
```

### 1.2 Docker 이미지 빌드 및 푸시

**방법 1: Cloud Build 사용 (권장)**
```bash
cd serverQdrChat2

# Cloud Build로 이미지 빌드 및 Cloud Run 배포
gcloud run deploy aijob-server \
  --source . \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --env-vars-file env.yaml \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10
```

**방법 2: 로컬에서 빌드 후 푸시**
```bash
cd serverQdrChat2

# Artifact Registry 레포지토리 생성 (최초 1회)
gcloud artifacts repositories create aijob-repo \
  --repository-format=docker \
  --location=asia-northeast3 \
  --description="AI Job Backend"

# Docker 이미지 빌드
docker build -t asia-northeast3-docker.pkg.dev/aijob-abf44/aijob-repo/aijob-server:latest .

# Docker 인증 설정
gcloud auth configure-docker asia-northeast3-docker.pkg.dev

# 이미지 푸시
docker push asia-northeast3-docker.pkg.dev/aijob-abf44/aijob-repo/aijob-server:latest

# Cloud Run 배포
gcloud run deploy aijob-server \
  --image asia-northeast3-docker.pkg.dev/aijob-abf44/aijob-repo/aijob-server:latest \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --env-vars-file env.yaml \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10
```

### 1.3 배포 확인
```bash
# 서비스 URL 확인
gcloud run services describe aijob-server --region asia-northeast3 --format 'value(status.url)'

# 예시: https://aijob-server-123456789-uc.a.run.app
```

### 1.4 환경 변수 업데이트 (배포 후)
```bash
gcloud run services update aijob-server \
  --region asia-northeast3 \
  --set-env-vars "GOOGLE_AI_KEY=your_key_here" \
  --set-env-vars "NAVER_CLIENT_ID=your_id_here"
```

---

## 2. 프론트엔드 배포 (Vercel)

### 2.1 Vercel CLI 설치
```bash
npm install -g vercel
```

### 2.2 Vercel 로그인 및 배포
```bash
# Vercel 로그인
vercel login

# 프로젝트 루트에서 배포
vercel

# 프로덕션 배포
vercel --prod
```

### 2.3 Vercel 대시보드에서 환경 변수 설정
1. https://vercel.com/dashboard 접속
2. 프로젝트 선택
3. Settings → Environment Variables
4. 다음 변수 추가:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=aijob-abf44.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=aijob-abf44
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=aijob-abf44.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 2.4 백엔드 URL 업데이트
배포된 백엔드 URL을 프론트엔드 코드에 반영:

```typescript
// app/search-chat/page.tsx
const response = await fetch("https://YOUR-CLOUD-RUN-URL/chat", {
  // ... 
})

// components/Chatbotpage.tsx
const response = await fetch("https://YOUR-CLOUD-RUN-URL/chat", {
  // ...
})
```

---

## 3. Firebase 설정

### 3.1 Firestore 보안 규칙 배포
```bash
firebase deploy --only firestore:rules
```

### 3.2 Firebase Storage 규칙 배포 (필요시)
```bash
firebase deploy --only storage
```

### 3.3 Firebase Functions 배포 (필요시)
```bash
cd functions-jnode
npm install
firebase deploy --only functions
```

---

## 4. 환경 변수 설정

### 4.1 백엔드 (Cloud Run)
`serverQdrChat2/env.yaml` 파일 확인:
```yaml
GOOGLE_AI_KEY: "AIza..."
FIREBASE_SERVICE_ACCOUNT_JSON: '{"type":"service_account",...}'

# 선택사항 (검색 품질 향상)
NAVER_CLIENT_ID: "your_naver_client_id"
NAVER_CLIENT_SECRET: "your_naver_client_secret"
SERPER_KEY: "your_serper_key"
```

### 4.2 프론트엔드 (Vercel)
`.env.local` 파일 생성 (로컬 개발용):
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

**⚠️ 주의**: `.env.local`은 `.gitignore`에 추가되어 있어야 합니다!

---

## 5. 배포 후 확인

### 5.1 백엔드 헬스 체크
```bash
curl https://YOUR-CLOUD-RUN-URL/health
```

**예상 응답:**
```json
{
  "status": "healthy"
}
```

### 5.2 프론트엔드 접속
1. 일반 챗봇: `https://your-domain.vercel.app/chatbot`
2. 검색 챗봇: `https://your-domain.vercel.app/search-chat`

### 5.3 기능 테스트
- [ ] 로그인/회원가입
- [ ] 일반 대화
- [ ] 메모 저장
- [ ] 검색 기능 (맛집 추천 등)
- [ ] Firebase 저장 확인

---

## 📋 빠른 배포 체크리스트

### 백엔드
- [ ] `gcloud` CLI 설치 및 로그인
- [ ] `env.yaml` 환경 변수 설정
- [ ] Docker 이미지 빌드 및 배포
- [ ] Cloud Run 서비스 URL 확인
- [ ] Health check 확인

### 프론트엔드
- [ ] Vercel 계정 생성
- [ ] 환경 변수 설정 (Firebase)
- [ ] 백엔드 URL을 코드에 반영
- [ ] `vercel --prod` 배포
- [ ] 배포된 사이트 접속 확인

### Firebase
- [ ] Firestore 보안 규칙 배포
- [ ] Firebase 프로젝트 설정 확인
- [ ] 서비스 계정 키 확인

---

## 🔧 트러블슈팅

### 백엔드 배포 실패
**문제**: `Permission denied` 오류
```bash
# IAM 권한 확인
gcloud projects add-iam-policy-binding aijob-abf44 \
  --member="user:your-email@gmail.com" \
  --role="roles/run.admin"
```

**문제**: 메모리 부족 오류
```bash
# 메모리 증가
gcloud run services update aijob-server \
  --region asia-northeast3 \
  --memory 4Gi
```

### 프론트엔드 빌드 실패
**문제**: 환경 변수 누락
- Vercel 대시보드에서 환경 변수 확인
- `NEXT_PUBLIC_` 접두사 확인

**문제**: Firebase 연결 실패
- Firebase 프로젝트 설정 확인
- API 키 유효성 검증

### CORS 오류
백엔드 `main.py`에서 CORS 설정 확인:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.vercel.app"],  # 실제 도메인으로 변경
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🎯 추가 최적화

### 1. Cloud Run 자동 스케일링
```bash
gcloud run services update aijob-server \
  --region asia-northeast3 \
  --min-instances 0 \
  --max-instances 20 \
  --concurrency 80
```

### 2. Cloud CDN 활성화 (Vercel은 자동)
프론트엔드는 Vercel이 자동으로 CDN을 제공합니다.

### 3. 모니터링 설정
- [Google Cloud Console](https://console.cloud.google.com/)
- Cloud Run → Metrics
- Logs Explorer에서 로그 확인

### 4. 커스텀 도메인 연결

**Vercel:**
1. Settings → Domains
2. 도메인 추가 및 DNS 설정

**Cloud Run:**
```bash
gcloud run services update aijob-server \
  --region asia-northeast3 \
  --custom-domain api.yourdomain.com
```

---

## 💡 비용 최적화 팁

1. **Cloud Run**: 
   - 최소 인스턴스 0으로 설정 (사용하지 않을 때 과금 없음)
   - 메모리는 필요한 만큼만 설정

2. **Vercel**: 
   - Hobby 플랜은 무료 (개인 프로젝트)
   - Pro 플랜은 $20/월

3. **Firebase**: 
   - Spark 플랜(무료) 사용 시 제한 확인
   - Blaze 플랜(종량제) 권장

---

## 📞 도움이 필요하신가요?

- Google Cloud Run 문서: https://cloud.google.com/run/docs
- Vercel 문서: https://vercel.com/docs
- Firebase 문서: https://firebase.google.com/docs

---

## 📝 다음 단계

배포 완료 후:
1. [ ] 도메인 연결
2. [ ] SSL 인증서 확인 (자동)
3. [ ] 모니터링 대시보드 설정
4. [ ] 백업 전략 수립
5. [ ] CI/CD 파이프라인 구축 (GitHub Actions)




