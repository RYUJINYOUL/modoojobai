# 🔐 GitHub Secrets 설정 가이드

GitHub Actions를 사용한 자동 배포를 위해 다음 Secrets를 설정해야 합니다.

## Secrets 설정 방법

1. GitHub 저장소 페이지 이동
2. **Settings** 탭 클릭
3. 좌측 메뉴에서 **Secrets and variables** → **Actions** 선택
4. **New repository secret** 버튼 클릭
5. 아래 각 Secret을 추가

---

## 필수 Secrets

### 1. `GCP_SA_KEY`
**설명**: Google Cloud 서비스 계정 키 (전체 JSON)

**발급 방법:**
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 (`aijob-abf44`)
3. **IAM 및 관리자** → **서비스 계정**
4. 서비스 계정 선택 또는 새로 생성
5. **키** 탭 → **키 추가** → **새 키 만들기**
6. JSON 형식 선택 → **만들기**
7. 다운로드된 JSON 파일의 **전체 내용**을 복사
8. GitHub Secrets에 붙여넣기

**필요한 권한:**
- Cloud Run Admin
- Storage Admin
- Artifact Registry Writer

### 2. `GOOGLE_AI_KEY`
**설명**: Google Gemini API 키

**발급 방법:**
1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. **Get API Key** 클릭
3. 키 복사하여 GitHub Secrets에 추가

**예시:**
```
AIzaSyABC123DEF456GHI789JKL012MNO345PQR
```

### 3. `FIREBASE_SERVICE_ACCOUNT_JSON`
**설명**: Firebase Admin SDK 서비스 계정 키 (한 줄 JSON)

**발급 방법:**
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 설정 → **서비스 계정** 탭
3. **새 비공개 키 생성** 클릭
4. 다운로드된 JSON 파일을 열고 **모든 줄바꿈을 제거**하여 한 줄로 만들기
5. GitHub Secrets에 추가

**예시 (한 줄로):**
```json
{"type":"service_account","project_id":"aijob-abf44","private_key_id":"abc123",...}
```

---

## 선택 Secrets (검색 품질 향상)

### 4. `NAVER_CLIENT_ID`
**설명**: NAVER 검색 API 클라이언트 ID

**발급 방법:**
1. [NAVER Developers](https://developers.naver.com/) 접속
2. 애플리케이션 등록
3. 검색 API (지역, 블로그, 뉴스) 추가
4. Client ID 복사

**예시:**
```
AbCdEfGhIjKlMnOp
```

### 5. `NAVER_CLIENT_SECRET`
**설명**: NAVER 검색 API 클라이언트 Secret

**발급 방법:**
- NAVER 애플리케이션 등록 시 함께 생성됨
- Client Secret 복사

**예시:**
```
QrStUvWxYz123456
```

### 6. `SERPER_KEY`
**설명**: Serper API 키 (Google 검색)

**발급 방법:**
1. [Serper.dev](https://serper.dev/) 접속
2. 회원가입 (무료 2,500 검색/월)
3. 대시보드에서 API Key 복사

**예시:**
```
1234567890abcdefghijklmnopqrstuv
```

---

## Secrets 확인

### 설정된 Secrets 목록

모든 Secrets를 추가한 후, GitHub 저장소의 **Settings → Secrets and variables → Actions** 페이지에서 다음 목록을 확인하세요:

✅ **필수 (3개)**
- `GCP_SA_KEY`
- `GOOGLE_AI_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

✅ **선택 (3개)**
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `SERPER_KEY`

---

## GitHub Actions 워크플로우 트리거

Secrets 설정 후, 다음 방법으로 배포를 트리거할 수 있습니다:

### 자동 배포 (main 브랜치 푸시 시)
```bash
git add .
git commit -m "Update backend"
git push origin main
```

`serverQdrChat2/` 디렉토리에 변경사항이 있으면 자동으로 배포됩니다.

### 수동 배포
1. GitHub 저장소 페이지 이동
2. **Actions** 탭 클릭
3. **Deploy Backend to Cloud Run** 워크플로우 선택
4. **Run workflow** 버튼 클릭
5. 브랜치 선택 후 **Run workflow** 실행

---

## 보안 주의사항

### ⚠️ 절대 하지 말 것
- Secrets를 코드에 하드코딩
- Secrets를 로그에 출력
- Public 저장소에 Secrets 노출
- Secrets를 다른 사람과 공유

### ✅ 안전한 사용법
- GitHub Secrets는 암호화되어 저장됨
- 워크플로우 로그에서는 `***`로 마스킹됨
- 필요한 최소한의 권한만 부여
- 정기적으로 키 교체 (3~6개월)

### 🔄 키 교체 시
1. 새 키 발급
2. GitHub Secrets 업데이트
3. 워크플로우 재실행하여 확인
4. 이전 키 비활성화

---

## 문제 해결

### "Error: Credentials JSON not found"
**원인**: `GCP_SA_KEY` Secret이 없거나 잘못됨

**해결**:
1. Google Cloud에서 서비스 계정 키 재다운로드
2. JSON 파일 전체 내용 복사 (첫 `{`부터 마지막 `}`까지)
3. GitHub Secrets에서 `GCP_SA_KEY` 업데이트

### "Error: Invalid API key"
**원인**: API 키가 만료되었거나 잘못됨

**해결**:
1. 해당 서비스에서 키 유효성 확인
2. 새 키 발급
3. GitHub Secrets 업데이트
4. 워크플로우 재실행

### "Error: Permission denied"
**원인**: 서비스 계정에 필요한 권한이 없음

**해결**:
1. Google Cloud Console → **IAM 및 관리자**
2. 서비스 계정 찾기
3. 다음 역할 추가:
   - Cloud Run Admin
   - Storage Admin
   - Artifact Registry Writer
   - Service Account User

---

## 워크플로우 상태 확인

### 실행 로그 보기
1. GitHub 저장소 → **Actions** 탭
2. 실행 중인 워크플로우 클릭
3. 각 단계의 로그 확인

### 성공적인 배포
```
✅ Authenticate to Google Cloud
✅ Build and Push Docker image
✅ Deploy to Cloud Run
✅ Show Service URL
```

### 실패 시 체크리스트
- [ ] 모든 필수 Secrets가 설정되었는가?
- [ ] Secret 값이 올바른가? (공백, 줄바꿈 확인)
- [ ] 서비스 계정 권한이 충분한가?
- [ ] Google Cloud 프로젝트 ID가 맞는가?
- [ ] 결제 계정이 활성화되어 있는가?

---

## 추가 리소스

- [GitHub Actions Secrets 문서](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Google Cloud 서비스 계정 가이드](https://cloud.google.com/iam/docs/service-accounts)
- [Firebase Admin SDK 설정](https://firebase.google.com/docs/admin/setup)

---

**Secrets 설정 완료 후 [배포 가이드](../DEPLOYMENT_GUIDE.md)를 참고하세요!**




