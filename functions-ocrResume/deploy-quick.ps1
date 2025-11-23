# ========================================
# 빠른 배포 스크립트 (PowerShell)
# ========================================

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🚀 Resume AI Service - 빠른 배포 시작" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 프로젝트 설정
$PROJECT_ID = "aijob-abf44"
$REGION = "asia-northeast3"
$SERVICE_NAME = "resume-ai-service"
$IMAGE_NAME = "gcr.io/$PROJECT_ID/$SERVICE_NAME"

Write-Host "📋 배포 설정:" -ForegroundColor Yellow
Write-Host "   프로젝트 ID: $PROJECT_ID"
Write-Host "   리전: $REGION"
Write-Host "   서비스 이름: $SERVICE_NAME"
Write-Host ""

# GEMINI_API_KEY 확인
if (-not $env:GEMINI_API_KEY) {
    Write-Host "❌ 오류: GEMINI_API_KEY 환경변수가 설정되지 않았습니다!" -ForegroundColor Red
    Write-Host ""
    Write-Host "다음 명령어로 설정하세요:" -ForegroundColor Yellow
    Write-Host '   $env:GEMINI_API_KEY="YOUR_API_KEY"' -ForegroundColor Green
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ GEMINI_API_KEY 확인 완료" -ForegroundColor Green
Write-Host ""

# Google Cloud 프로젝트 설정
Write-Host "📋 Google Cloud 프로젝트 설정..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 프로젝트 설정 실패" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Docker 이미지 빌드
Write-Host "🐳 Docker 이미지 빌드 중..." -ForegroundColor Yellow
docker build -t $IMAGE_NAME .
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker 빌드 실패" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ Docker 이미지 빌드 완료" -ForegroundColor Green
Write-Host ""

# Container Registry에 푸시
Write-Host "📤 Container Registry에 이미지 푸시 중..." -ForegroundColor Yellow
docker push $IMAGE_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker 푸시 실패" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✅ 이미지 푸시 완료" -ForegroundColor Green
Write-Host ""

# Cloud Run에 배포
Write-Host "☁️ Cloud Run에 배포 중..." -ForegroundColor Yellow
gcloud run deploy $SERVICE_NAME `
  --image $IMAGE_NAME `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars="GEMINI_API_KEY=$env:GEMINI_API_KEY" `
  --memory=1Gi `
  --cpu=1 `
  --concurrency=80 `
  --max-instances=100 `
  --timeout=300

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cloud Run 배포 실패" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# 배포된 URL 가져오기
Write-Host "🔍 배포된 서비스 URL 확인 중..." -ForegroundColor Yellow
$SERVICE_URL = gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "✅ 배포 완료!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 서비스 URL: $SERVICE_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 환경변수 설정 (.env 파일에 추가):" -ForegroundColor Yellow
Write-Host "   NEXT_PUBLIC_RESUME_AI_API_URL=$SERVICE_URL" -ForegroundColor White
Write-Host ""
Write-Host "🔧 테스트 명령어:" -ForegroundColor Yellow
Write-Host "   curl $SERVICE_URL/health" -ForegroundColor White
Write-Host ""
Write-Host "💡 상세 로그 확인:" -ForegroundColor Yellow
Write-Host "   gcloud logging read `"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME`" --limit 50" -ForegroundColor White
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan

Read-Host "Press Enter to exit"












