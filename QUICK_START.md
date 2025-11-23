# ⚡ 빠른 시작 가이드

## 🎯 목표
이 가이드는 프로젝트를 5분 안에 로컬에서 실행하는 방법을 안내합니다.

---

## 📋 사전 준비

### 필수 도구
- [Node.js](https://nodejs.org/) (v18 이상)
- [Python](https://www.python.org/) (v3.11 이상)
- [Git](https://git-scm.com/)

### 선택 도구 (배포용)
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Vercel CLI](https://vercel.com/docs/cli)

---

## 🚀 로컬 실행 (개발 환경)

### 1️⃣ 저장소 클론
```bash
git clone https://github.com/your-username/job_ai.git
cd job_ai
```

### 2️⃣ 프론트엔드 실행

```bash
# 패키지 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 Firebase 설정 입력

# 개발 서버 실행
npm run dev
```

**접속**: http://localhost:3000

### 3️⃣ 백엔드 실행 (serverQdrChat2)

```bash
cd serverQdrChat2

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 패키지 설치
pip install -r requirements.txt

# 환경 변수 설정
cp env.yaml.example env.yaml
# env.yaml 파일을 열어 API 키 입력

# 서버 실행
python main.py
```

**접속**: http://localhost:8080/health

---

## 🔑 환경 변수 설정

### 프론트엔드 (`.env.local`)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Firebase 설정 찾기**:
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택 → 프로젝트 설정 → 일반
3. "내 앱" 섹션에서 웹 앱 선택
4. "Firebase SDK 스니펫" → "구성" 선택

### 백엔드 (`serverQdrChat2/env.yaml`)
```yaml
GOOGLE_AI_KEY: "your_gemini_api_key"
FIREBASE_SERVICE_ACCOUNT_JSON: '{"type":"service_account",...}'

# 선택사항 (검색 품질 향상)
NAVER_CLIENT_ID: "your_naver_id"
NAVER_CLIENT_SECRET: "your_naver_secret"
SERPER_KEY: "your_serper_key"
```

**API 키 발급**:
- **Gemini**: [Google AI Studio](https://aistudio.google.com/app/apikey)
- **NAVER**: [NAVER Developers](https://developers.naver.com/)
- **Serper**: [Serper.dev](https://serper.dev/)

---

## 📦 배포

### 방법 1: 자동 스크립트 (권장)

**Windows:**
```bash
cd serverQdrChat2
deploy.bat
```

**Mac/Linux:**
```bash
cd serverQdrChat2
chmod +x deploy.sh
./deploy.sh
```

### 방법 2: 수동 배포

**백엔드 (Google Cloud Run):**
```bash
cd serverQdrChat2
gcloud run deploy aijob-server \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated
```

**프론트엔드 (Vercel):**
```bash
npm install -g vercel
vercel --prod
```

---

## 🧪 테스트

### 백엔드 헬스 체크
```bash
curl http://localhost:8080/health
```

**예상 응답:**
```json
{
  "status": "healthy",
  "services": {
    "gemini": true,
    "naver": true,
    "serper": false,
    "trafilatura": true
  }
}
```

### 프론트엔드 접속
- 메인 페이지: http://localhost:3000
- 일반 챗봇: http://localhost:3000/chatbot
- 검색 챗봇: http://localhost:3000/search-chat

---

## 🐛 문제 해결

### 프론트엔드 빌드 오류
```bash
# 캐시 삭제 후 재설치
rm -rf node_modules .next
npm install
npm run dev
```

### 백엔드 ImportError
```bash
# 가상환경 재생성
rm -rf venv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Firebase 연결 실패
1. `.env.local` 파일 확인
2. Firebase 프로젝트 설정 확인
3. 브라우저 콘솔에서 오류 메시지 확인

### CORS 오류
백엔드 URL이 프론트엔드 코드에 올바르게 설정되어 있는지 확인:
- `app/search-chat/page.tsx` (line 269)
- `components/Chatbotpage.tsx` (line 121)

---

## 📚 다음 단계

✅ 로컬 실행 완료
- [ ] [배포 가이드](DEPLOYMENT_GUIDE.md) 읽기
- [ ] [검색 통합 문서](serverQdrChat2/SEARCH_INTEGRATION.md) 확인
- [ ] 커스텀 도메인 연결
- [ ] CI/CD 파이프라인 구축

---

## 💡 유용한 명령어

### 프론트엔드
```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버
npm run lint         # 린트 검사
```

### 백엔드
```bash
python main.py       # 서버 실행
pytest              # 테스트 실행 (있는 경우)
pip freeze > requirements.txt  # 패키지 목록 업데이트
```

### Docker
```bash
docker build -t aijob-server .           # 이미지 빌드
docker run -p 8080:8080 aijob-server     # 컨테이너 실행
docker ps                                # 실행 중인 컨테이너 확인
```

### Google Cloud
```bash
gcloud auth login                        # 로그인
gcloud config set project aijob-abf44    # 프로젝트 설정
gcloud run services list                 # 서비스 목록
gcloud run logs read aijob-server        # 로그 확인
```

---

## 📞 도움이 필요하신가요?

- 📖 [전체 배포 가이드](DEPLOYMENT_GUIDE.md)
- 🔍 [검색 통합 문서](serverQdrChat2/SEARCH_INTEGRATION.md)
- 🐛 [GitHub Issues](https://github.com/your-username/job_ai/issues)

---

**즐거운 개발 되세요! 🚀**




