@echo off
REM ========================================
REM 빠른 배포 스크립트 (Windows)
REM ========================================

echo.
echo ============================================================
echo 🚀 Resume AI Service - 빠른 배포 시작
echo ============================================================
echo.

REM 프로젝트 설정
set PROJECT_ID=aijob-abf44
set REGION=asia-northeast3
set SERVICE_NAME=resume-ai-service
set IMAGE_NAME=gcr.io/%PROJECT_ID%/%SERVICE_NAME%

echo 📋 배포 설정:
echo    프로젝트 ID: %PROJECT_ID%
echo    리전: %REGION%
echo    서비스 이름: %SERVICE_NAME%
echo.

REM GEMINI_API_KEY 확인
if "%GEMINI_API_KEY%"=="" (
    echo ❌ 오류: GEMINI_API_KEY 환경변수가 설정되지 않았습니다!
    echo.
    echo 다음 명령어로 설정하세요:
    echo    PowerShell: $env:GEMINI_API_KEY="YOUR_API_KEY"
    echo    CMD: set GEMINI_API_KEY=YOUR_API_KEY
    echo.
    pause
    exit /b 1
)

echo ✅ GEMINI_API_KEY 확인 완료
echo.

REM Google Cloud 프로젝트 설정
echo 📋 Google Cloud 프로젝트 설정...
gcloud config set project %PROJECT_ID%
if errorlevel 1 (
    echo ❌ 프로젝트 설정 실패
    pause
    exit /b 1
)
echo.

REM Docker 이미지 빌드
echo 🐳 Docker 이미지 빌드 중...
docker build -t %IMAGE_NAME% .
if errorlevel 1 (
    echo ❌ Docker 빌드 실패
    pause
    exit /b 1
)
echo ✅ Docker 이미지 빌드 완료
echo.

REM Container Registry에 푸시
echo 📤 Container Registry에 이미지 푸시 중...
docker push %IMAGE_NAME%
if errorlevel 1 (
    echo ❌ Docker 푸시 실패
    pause
    exit /b 1
)
echo ✅ 이미지 푸시 완료
echo.

REM Cloud Run에 배포
echo ☁️ Cloud Run에 배포 중...
gcloud run deploy %SERVICE_NAME% ^
  --image %IMAGE_NAME% ^
  --region %REGION% ^
  --platform managed ^
  --allow-unauthenticated ^
  --set-env-vars="GEMINI_API_KEY=%GEMINI_API_KEY%" ^
  --memory=1Gi ^
  --cpu=1 ^
  --concurrency=80 ^
  --max-instances=100 ^
  --timeout=300

if errorlevel 1 (
    echo ❌ Cloud Run 배포 실패
    pause
    exit /b 1
)
echo.

REM 배포된 URL 가져오기
echo 🔍 배포된 서비스 URL 확인 중...
for /f "delims=" %%i in ('gcloud run services describe %SERVICE_NAME% --region=%REGION% --format="value(status.url)"') do set SERVICE_URL=%%i

echo.
echo ============================================================
echo ✅ 배포 완료!
echo ============================================================
echo.
echo 🌐 서비스 URL: %SERVICE_URL%
echo.
echo 📝 환경변수 설정 (.env 파일에 추가):
echo    NEXT_PUBLIC_RESUME_AI_API_URL=%SERVICE_URL%
echo.
echo 🔧 테스트 명령어:
echo    curl %SERVICE_URL%/health
echo.
echo 💡 상세 로그 확인:
echo    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=%SERVICE_NAME%" --limit 50
echo.
echo ============================================================

pause












