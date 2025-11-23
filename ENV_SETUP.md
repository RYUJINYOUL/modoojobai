# 🔑 환경 변수 설정 가이드

## 프론트엔드 설정

### `.env.local` 파일 생성
프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```bash
# Firebase 설정
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Cloud Run 서비스 URL (배포 후 설정)
NEXT_PUBLIC_MEMO_API_URL=https://your-cloud-run-service-url
```

### Firebase 설정값 찾기

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 ⚙️ (설정) 클릭 → **프로젝트 설정**
4. **일반** 탭에서 아래로 스크롤
5. **내 앱** 섹션에서 웹 앱 (`</>`) 선택
6. **Firebase SDK 스니펫** → **구성** 선택
7. 표시된 값을 복사하여 `.env.local`에 붙여넣기

---

## Cloud Run 서비스 설정

### 1. Google Cloud 설정

#### Google Cloud CLI 설치
```bash
# macOS
brew install google-cloud-sdk

# Windows - https://cloud.google.com/sdk/docs/install 에서 다운로드
```

#### 프로젝트 설정
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 2. Memo AI 서비스 배포

#### `functions-memo/env.yaml` 파일 생성
```bash
cd functions-memo
cp env.yaml.example env.yaml
```

#### API 키 설정

##### Upstage API 키 (OCR용)
**발급 방법:**
1. [Upstage Console](https://console.upstage.ai/) 접속
2. 회원가입 및 로그인
3. **API Keys** 메뉴 선택
4. **Create API Key** 클릭
5. 생성된 키를 `env.yaml`에 설정

##### Google AI (Gemini) API 키
**발급 방법:**
1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. Google 계정으로 로그인
3. **Get API Key** 클릭
4. **Create API key** 선택
5. 생성된 키를 `env.yaml`에 설정

#### 배포 실행
```bash
# Linux/macOS
chmod +x deploy.sh
./deploy.sh

# Windows
deploy.bat
```

배포 완료 후 출력되는 서비스 URL을 복사하여 프론트엔드 `.env.local`에 설정하세요.

---

## 기존 백엔드 설정 (serverQdrChat2)

### `serverQdrChat2/env.yaml` 파일 생성

```bash
cd serverQdrChat2
cp env.yaml.example env.yaml
```

### Firebase 서비스 계정 키
```yaml
FIREBASE_SERVICE_ACCOUNT_JSON: '{"type":"service_account","project_id":"...",...}'
```

**발급 방법:**
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. ⚙️ (설정) → **프로젝트 설정**
4. **서비스 계정** 탭 선택
5. **새 비공개 키 생성** 클릭
6. 다운로드된 JSON 파일 열기
7. **전체 내용을 한 줄로 복사**하여 `env.yaml`에 붙여넣기

**⚠️ 중요**: JSON 내용을 작은따옴표(`'`)로 감싸야 합니다!

### 선택 환경 변수 (검색 품질 향상)

#### NAVER 검색 API (선택사항)
```yaml
NAVER_CLIENT_ID: "your_client_id"
NAVER_CLIENT_SECRET: "your_client_secret"
```

**발급 방법:**
1. [NAVER Developers](https://developers.naver.com/) 접속
2. 로그인 → **Application** → **애플리케이션 등록**
3. 애플리케이션 이름 입력 (예: "모두트리 AI")
4. **사용 API** 선택:
   - 검색 → **지역**
   - 검색 → **블로그**
   - 검색 → **뉴스**
5. 웹 서비스 URL: `http://localhost:8080`
6. 등록 후 **Client ID**와 **Client Secret** 복사

#### Serper API (Google 검색, 선택사항)
```yaml
SERPER_KEY: "your_serper_key"
```

**발급 방법:**
1. [Serper.dev](https://serper.dev/) 접속
2. 회원가입 (Google 계정 사용 가능)
3. 무료 플랜 선택 (2,500 검색/월)
4. 대시보드에서 API Key 복사

---

## 설정 확인

### 프론트엔드
```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속
- 오류 없이 로딩되면 성공 ✅
- Firebase 연결 오류가 있다면 `.env.local` 확인

### 백엔드
```bash
cd serverQdrChat2
python main.py
```

터미널에서 다음 메시지 확인:
```
✅ Gemini Client 초기화 완료
✅ 로컬 서비스 계정 파일로 Firebase 초기화
✅ NAVER: 연결됨
✅ Trafilatura: 활성화
```

헬스 체크:
```bash
curl http://localhost:8080/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "db_connected": true,
  "services": {
    "gemini": true,
    "naver": true,
    "serper": false,
    "trafilatura": true
  }
}
```

---

## 보안 주의사항

### ⚠️ 절대 커밋하지 말 것
- `.env.local`
- `env.yaml`
- `serviceAccountKey.json`
- 모든 API 키 파일

### ✅ 안전하게 관리하기
1. `.gitignore`에 이미 추가되어 있는지 확인
2. GitHub에 푸시하기 전 `git status`로 확인
3. 실수로 커밋했다면 즉시 키 재발급

### 🔐 프로덕션 환경
- Vercel: 환경 변수는 대시보드에서 설정
- Google Cloud Run: `--env-vars-file` 또는 Secret Manager 사용
- Firebase 서비스 계정 키는 Secret Manager에 저장 권장

---

## 문제 해결

### Firebase 연결 오류
**증상**: "Firebase: Error (auth/invalid-api-key)"

**해결**:
1. `.env.local` 파일이 프로젝트 루트에 있는지 확인
2. 모든 `NEXT_PUBLIC_` 접두사가 정확한지 확인
3. Firebase Console에서 설정값 재확인
4. 개발 서버 재시작 (`npm run dev`)

### Gemini API 오류
**증상**: "⚠️ GOOGLE_AI_KEY 환경 변수가 설정되지 않았습니다"

**해결**:
1. `serverQdrChat2/env.yaml` 파일 확인
2. API 키 형식 확인 (따옴표로 감싸기)
3. Google AI Studio에서 키 유효성 확인
4. 서버 재시작

### NAVER API 403 오류
**증상**: "⚠️ naver API 에러: 403 Forbidden"

**해결**:
1. NAVER Developers에서 애플리케이션 설정 확인
2. 서비스 URL이 올바른지 확인
3. API 사용량 한도 확인 (일 25,000건)
4. Client ID/Secret 재확인

---

## 예제 파일

### `.env.local` (프론트엔드)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyABC123...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=myapp-12345.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=myapp-12345
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=myapp-12345.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456

# Cloud Run 서비스 URL
NEXT_PUBLIC_MEMO_API_URL=https://memo-ai-service-abc123-an.a.run.app
```

### `functions-memo/env.yaml` (Memo AI 서비스)
```yaml
UPSTAGE_API_KEY: "up_1234567890abcdef..."
GEMINI_API_KEY: "AIzaSyDWEr_j7ps5GcuHMiXCPSwCfasT2zRdqKo"
```

### `serverQdrChat2/env.yaml` (백엔드)
```yaml
GOOGLE_AI_KEY: "AIzaSyDWEr_j7ps5GcuHMiXCPSwCfasT2zRdqKo"

FIREBASE_SERVICE_ACCOUNT_JSON: '{"type":"service_account","project_id":"myapp-12345","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk@myapp-12345.iam.gserviceaccount.com",...}'

# 선택사항
NAVER_CLIENT_ID: "AbCdEfGhIj"
NAVER_CLIENT_SECRET: "KlMnOpQrSt"
SERPER_KEY: "1234567890abcdef"
```

---

**설정 완료 후 [빠른 시작 가이드](QUICK_START.md)를 따라 진행하세요!**




